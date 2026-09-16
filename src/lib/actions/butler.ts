"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { getRestaurant } from "@/lib/restaurants/queries";
import * as butler from "@/lib/butler";
import { runButlerRules } from "@/lib/butler/tasks";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";
import type { ButlerSource } from "@/types/butler";

/**
 * Server actions in front of the Butler. Each one resolves the workspace
 * from the session (never from the client), checks access, and turns any
 * provider failure into a sentence a person can act on.
 */

function explain(err: unknown): string {
  if (err instanceof butler.AiNotConfiguredError) return "AI isn't configured for this deployment yet. Add GEMINI_API_KEY in Settings → Connectors.";
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|network|timeout|ECONN/i.test(message)) return "Couldn't reach the AI service just now. Try again in a moment.";
  return message.length > 200 ? "The Butler couldn't complete that. The problem has been logged." : message;
}

export interface DraftResult {
  ok: boolean;
  error?: string;
  draft: string;
  summary: string;
  escalate: boolean;
  escalateReason: string | null;
  sources: string[];
}

const EMPTY: Omit<DraftResult, "ok"> = { draft: "", summary: "", escalate: false, escalateReason: null, sources: [] };

const sourceLabels = (sources: ButlerSource[]) => sources.filter((s) => s.kind !== "template").map((s) => s.title);

export async function draftRestaurantReply(input: { restaurantId: string; message: string; customerName: string | null }): Promise<DraftResult> {
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet.", ...EMPTY };
  const hostId = await getCurrentHostId();
  const restaurant = await getRestaurant(hostId, input.restaurantId);
  if (!restaurant) return { ok: false, error: "That restaurant no longer exists.", ...EMPTY };

  const message = input.message.trim().slice(0, 6000);
  if (!message) return { ok: false, error: "Paste the customer's message first.", ...EMPTY };

  try {
    const result = await butler.draftRestaurantReply(hostId, { name: restaurant.name, notes: restaurant.notes, status: restaurant.status }, message, input.customerName);
    return { ok: true, draft: result.draft, summary: result.summary, escalate: result.escalate, escalateReason: result.escalateReason, sources: sourceLabels(result.sources) };
  } catch (err) {
    return { ok: false, error: explain(err), ...EMPTY };
  }
}

export async function draftFleetReply(input: { message: string; guestName?: string; vehicle?: string; subject?: string }): Promise<DraftResult> {
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet.", ...EMPTY };
  const hostId = await getCurrentHostId();
  const body = input.message.trim().slice(0, 8000);
  if (!body) return { ok: false, error: "Paste the guest's message first.", ...EMPTY };

  try {
    const result = await butler.analyzeFleetMessage(hostId, {
      guestName: input.guestName?.trim() || "This guest",
      vehicle: input.vehicle?.trim() || "their vehicle",
      subject: input.subject?.trim() || "",
      body,
      receivedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      draft: result.draftReply ?? "",
      summary: result.summary,
      escalate: result.escalate,
      escalateReason: result.escalateReason,
      sources: sourceLabels(result.sources),
    };
  } catch (err) {
    return { ok: false, error: explain(err), ...EMPTY };
  }
}

export interface AnswerResult {
  ok: boolean;
  error?: string;
  answer: string;
  uncertain: boolean;
  sources: { title: string; url: string | null }[];
}

export async function askButler(question: string): Promise<AnswerResult> {
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet.", answer: "", uncertain: true, sources: [] };
  const q = question.trim().slice(0, 1500);
  if (q.length < 3) return { ok: false, error: "Ask a full question.", answer: "", uncertain: true, sources: [] };

  const hostId = await getCurrentHostId();
  try {
    const result = await butler.answer(hostId, q);
    return { ok: true, answer: result.answer, uncertain: result.uncertain, sources: result.sources.map((s) => ({ title: s.title, url: s.url })) };
  } catch (err) {
    return { ok: false, error: explain(err), answer: "", uncertain: true, sources: [] };
  }
}

export interface RunResult {
  ok: boolean;
  error?: string;
  tasksCreated: number;
  notificationsCreated: number;
  signals: string[];
}

/** Runs the Butler's rules now — the "Refresh" button on the Butler page. */
export async function runButlerNow(): Promise<RunResult> {
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet.", tasksCreated: 0, notificationsCreated: 0, signals: [] };
  if (!(await canEditCurrentFleet())) return { ok: false, error: "You have read-only access to this workspace.", tasksCreated: 0, notificationsCreated: 0, signals: [] };

  const session = await auth();
  const hostId = await getCurrentHostId();
  const result = await runButlerRules(hostId, { userEmail: session?.user?.email ?? null });

  if (result.tasksCreated > 0) {
    await logActivity({ hostId, module: "butler", event: "butler.tasks", description: `Butler filed ${result.tasksCreated} task${result.tasksCreated === 1 ? "" : "s"}`, href: routes.tasks });
  }
  revalidatePath(routes.butler);
  revalidatePath(routes.tasks);
  revalidatePath(routes.app, "layout");
  return { ok: true, ...result };
}

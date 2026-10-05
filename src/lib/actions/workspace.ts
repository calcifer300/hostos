"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";
import { canManageSettings, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { ALL_MODULES, isWorkspaceModule, type WorkspaceModule } from "@/lib/modules";
import { deleteTemplate, saveTemplate, type TemplateCategory, type TemplateModule } from "@/lib/templates/queries";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";

export interface WorkspaceActionResult {
  ok: boolean;
  error?: string;
}

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet." };
  if (!(await canManageSettings())) return { error: "Only an owner, admin or manager can change workspace settings." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

/** Which verticals this workspace runs. At least one stays on. */
export async function setWorkspaceModules(modules: string[]): Promise<WorkspaceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const valid = ALL_MODULES.filter((m) => modules.includes(m));
  if (valid.length === 0) return { ok: false, error: "Keep at least one module enabled." };
  if (!modules.every(isWorkspaceModule)) return { ok: false, error: "Unknown module." };

  const result = await runMutation("hosts.modules", (client) => client.from("hosts").update({ modules: valid }).eq("id", g.hostId));
  if (!result.ok) return { ok: false, error: result.error.includes("hasn't been created") || /column/i.test(result.error) ? "Run migration 0017 to enable module settings." : result.error };

  await logActivity({ hostId: g.hostId, module: "system", event: "workspace.modules", description: `Modules set to ${valid.join(", ")}`, actorEmail: g.email });
  revalidatePath(routes.settings);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

export interface TemplateFormInput {
  id?: string;
  module: WorkspaceModule | "other";
  title: string;
  category: string;
  triggers?: string;
  body: string;
}

const CATEGORIES: TemplateCategory[] = ["check_in", "in_trip", "return", "post_trip", "host_report", "customer", "other"];

export async function saveReplyTemplate(input: TemplateFormInput): Promise<WorkspaceActionResult & { id?: string }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: "Give the template a title." };
  if (!body) return { ok: false, error: "Write the template body." };
  const templateModule: TemplateModule = input.module === "fleet" || input.module === "restaurants" ? input.module : "other";
  const category = CATEGORIES.includes(input.category as TemplateCategory) ? (input.category as TemplateCategory) : "other";

  const id = await saveTemplate(g.hostId, { module: templateModule, title, category, triggers: input.triggers?.trim() || null, body }, input.id, g.email);
  if (!id) return { ok: false, error: "Couldn't save the template. Run migration 0020 if this keeps happening." };

  revalidatePath(routes.settings);
  return { ok: true, id };
}

export async function removeReplyTemplate(id: string): Promise<WorkspaceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const ok = await deleteTemplate(g.hostId, id);
  if (!ok) return { ok: false, error: "Couldn't delete the template." };
  revalidatePath(routes.settings);
  return { ok: true };
}

export async function seedDefaultTemplates(): Promise<WorkspaceActionResult & { added?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { DEFAULT_TEMPLATES } = await import("@/lib/templates/queries");
  let added = 0;
  for (const t of DEFAULT_TEMPLATES) {
    const id = await saveTemplate(g.hostId, t, undefined, g.email);
    if (id) added += 1;
  }
  revalidatePath(routes.settings);
  return { ok: added > 0, added, error: added === 0 ? "Couldn't add the starter templates. Run migration 0020 first." : undefined };
}

import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Reply templates (migration 0020): the workspace's own saved messages,
 * shared by every member, the Companion and the Butler.
 */

export type TemplateModule = "fleet" | "restaurants" | "other";
export type TemplateCategory = "check_in" | "in_trip" | "return" | "post_trip" | "host_report" | "customer" | "other";

export interface ReplyTemplate {
  id: string;
  module: TemplateModule;
  title: string;
  category: TemplateCategory;
  triggers: string | null;
  body: string;
  sortOrder: number;
  updatedAt: string;
}

interface TemplateRow {
  id: string;
  module: string;
  title: string;
  category: string;
  triggers: string | null;
  body: string;
  sort_order: number;
  updated_at: string;
}

const MODULES = new Set<string>(["fleet", "restaurants", "other"]);
const CATEGORIES = new Set<string>(["check_in", "in_trip", "return", "post_trip", "host_report", "customer", "other"]);

function rowToTemplate(row: TemplateRow): ReplyTemplate {
  return {
    id: row.id,
    module: (MODULES.has(row.module) ? row.module : "other") as TemplateModule,
    title: row.title,
    category: (CATEGORIES.has(row.category) ? row.category : "other") as TemplateCategory,
    triggers: row.triggers,
    body: row.body,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

export const getReplyTemplates = cache(async function getReplyTemplates(hostId: string): Promise<ReplyTemplate[]> {
  const { data } = await runQueryOr<TemplateRow[]>("reply_templates.list", [], (client) =>
    client
      .from("reply_templates")
      .select("id, module, title, category, triggers, body, sort_order, updated_at")
      .eq("host_id", hostId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<TemplateRow[]>()
  );
  return data.map(rowToTemplate);
});

export interface TemplateInput {
  module: TemplateModule;
  title: string;
  category: TemplateCategory;
  triggers: string | null;
  body: string;
  sortOrder?: number;
}

export async function saveTemplate(hostId: string, input: TemplateInput, id?: string, actor?: string | null): Promise<string | null> {
  const row = {
    host_id: hostId,
    module: input.module,
    title: input.title.slice(0, 120),
    category: input.category,
    triggers: input.triggers?.slice(0, 500) || null,
    body: input.body.slice(0, 6000),
    sort_order: input.sortOrder ?? 0,
    created_by: actor ?? null,
  };

  const outcome = id
    ? await runQuery<{ id: string } | null>("reply_templates.update", (client) =>
        client.from("reply_templates").update(row).eq("host_id", hostId).eq("id", id).select("id").maybeSingle<{ id: string }>()
      )
    : await runQuery<{ id: string } | null>("reply_templates.insert", (client) =>
        client.from("reply_templates").insert(row).select("id").maybeSingle<{ id: string }>()
      );

  return outcome.ok ? outcome.data?.id ?? null : null;
}

export async function deleteTemplate(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("reply_templates.delete", (client) => client.from("reply_templates").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

/**
 * The starter set a new workspace gets, merged from the app's own check-in /
 * return messages and the co-host templates Karl shipped in his tracker.
 * Placeholders use {BRACES}; see renderTemplate.
 */
export const DEFAULT_TEMPLATES: TemplateInput[] = [
  {
    module: "fleet",
    title: "Pre-trip check-in and lockbox",
    category: "check_in",
    triggers: "where is the car, lockbox code, how do I pick up, pickup instructions",
    body: `Hi {GUEST_NAME}! Your {VEHICLE} ({PLATE}) is ready for pickup.\n\n📍 Location: {PICKUP_LOCATION}\n🔑 Lockbox: the code is sent here one hour before your trip starts.\n📅 Start time: {START_TIME}\n\nPlease upload a photo of your driver's license and a selfie holding it in the Turo app before you arrive — keys can't be released until Turo confirms it. Safe travels, and message us any time you need help.`,
    sortOrder: 1,
  },
  {
    module: "fleet",
    title: "Mid-trip check-in",
    category: "in_trip",
    triggers: "how is the trip going, everything ok",
    body: `Hi {GUEST_NAME}, quick check-in from the team — hope the {VEHICLE} is treating you well! Let us know if you have any questions about the car or want to extend your trip.`,
    sortOrder: 2,
  },
  {
    module: "fleet",
    title: "Return reminder",
    category: "return",
    triggers: "where do I return, return instructions, drop off, what time is return",
    body: `Hi {GUEST_NAME}! A reminder that your trip with the {VEHICLE} ({PLATE}) ends at {END_TIME}.\n\n🅿️ Return: {RETURN_LOCATION}\n🔑 Lock the car and leave the key in the lockbox.\n⛽ Fuel: please return at the same level as pickup to avoid a refuelling fee.\n\nThank you for choosing us!`,
    sortOrder: 3,
  },
  {
    module: "fleet",
    title: "Post-trip thank you and review",
    category: "post_trip",
    triggers: "thanks for the trip, review, rating",
    body: `Hi {GUEST_NAME}, thank you for returning the {VEHICLE} in great shape! We've left you a 5-star rating — if you enjoyed the trip, a review back would mean a lot. Hope to host you again.`,
    sortOrder: 4,
  },
  {
    module: "fleet",
    title: "Update to the vehicle owner",
    category: "host_report",
    triggers: null,
    body: `Hi {HOST_NAME}, co-host update on your {VEHICLE} ({PLATE}): the trip with {GUEST_NAME} has ended. Post-trip inspection done, fuel checked and the car is parked at {RETURN_LOCATION}, ready for the next guest.`,
    sortOrder: 5,
  },
  {
    module: "restaurants",
    title: "Missing item apology",
    category: "customer",
    triggers: "missing item, didn't get, forgot my, not in the bag",
    body: `We're really sorry — that shouldn't have happened. We've flagged the missing item with DoorDash support so the credit is processed on your order, and we're double-checking every bag at the pass tonight. Thank you for letting us know.`,
    sortOrder: 10,
  },
  {
    module: "restaurants",
    title: "Late delivery",
    category: "customer",
    triggers: "late, still waiting, where is my order, taking so long",
    body: `Sorry for the wait. Your order left the kitchen on time and is with the Dasher now; if it's cold on arrival, let us know and we'll flag it with DoorDash for a credit. Thanks for your patience.`,
    sortOrder: 11,
  },
];

/**
 * Fills {PLACEHOLDERS}. Unknown placeholders are left in place so a person
 * sees what still needs a value rather than sending a blank.
 */
export function renderTemplate(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{([A-Z_]+)\}/g, (match, key: string) => {
    const v = values[key];
    return v ? v : match;
  });
}

/**
 * PLATFORM roles — who a person is to HostOS Collective. Distinct from
 * workspace roles (lib/roles/permissions.ts), which say what someone may do
 * inside one workspace. A fixed list, so a typo can't silently create a new
 * "role" nobody recognises. No "server-only" here: the picker in Settings
 * needs the list too.
 */
export const ROLE_OPTIONS = ["Founder", "CTO", "Lead Developer", "Developer", "Support", "Fleet Owner", "Co-host/VA"] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

/**
 * Anyone holding one of these can see and use the platform admin tools in
 * Settings (platform roles, deployment diagnostics). Checked both in the page
 * (hides the section) and in the server actions (so the check isn't just a
 * hidden button away from being bypassed).
 */
export const DEV_TOOLS_ROLES = new Set<string>(["Founder", "CTO", "Lead Developer", "Developer"]);

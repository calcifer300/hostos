/**
 * PLATFORM roles — who a person is to HostOS Collective. Distinct from
 * workspace roles (lib/roles/permissions.ts), which say what someone may do
 * inside one workspace. A fixed list, so a typo can't silently create a new
 * "role" nobody recognises. No "server-only" here: the picker in Settings
 * needs the list too.
 *
 * Every role is Title Case ("Virtual Assistant", "Tech Lead"). Values that
 * were stored before that rule existed are normalised on read and on write
 * by normalizeRoleName(), so "Virtual assistant" in the table still means
 * the same role.
 */
export const ROLE_OPTIONS = [
  "Founder",
  "CTO",
  "Tech Lead",
  "Lead Developer",
  "Developer",
  "Operations Manager",
  "Support",
  "Fleet Owner",
  "Virtual Assistant",
  "Co-Host / VA",
] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

/**
 * Anyone holding one of these can see and use the platform admin tools in
 * Settings (platform roles, deployment diagnostics). Checked both in the page
 * (hides the section) and in the server actions (so the check isn't just a
 * hidden button away from being bypassed).
 */
export const DEV_TOOLS_ROLES = new Set<string>(["Founder", "CTO", "Tech Lead", "Lead Developer", "Developer"]);

/** Spellings that predate the canonical list. Keys are lower-case. */
const LEGACY_ALIASES: Record<string, Role> = {
  "co-host/va": "Co-Host / VA",
  "cohost/va": "Co-Host / VA",
  "co-host": "Co-Host / VA",
  "cohost": "Co-Host / VA",
  "va": "Virtual Assistant",
  "virtual assistant": "Virtual Assistant",
  "tech lead": "Tech Lead",
  "lead dev": "Lead Developer",
  "ops manager": "Operations Manager",
  "operations manager": "Operations Manager",
};

/** "virtual assistant" → "Virtual Assistant"; every word, including after "/" and "-". */
export function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s/\-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The canonical spelling of a stored role, or a Title Case fallback for one the list doesn't know. */
export function normalizeRoleName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const alias = LEGACY_ALIASES[lower];
  if (alias) return alias;
  const known = ROLE_OPTIONS.find((r) => r.toLowerCase() === lower);
  return known ?? titleCase(trimmed);
}

/** Canonical, de-duplicated, empty strings dropped — the shape every consumer sees. */
export function normalizeRoleList(raw: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const r of raw ?? []) {
    const name = normalizeRoleName(String(r));
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

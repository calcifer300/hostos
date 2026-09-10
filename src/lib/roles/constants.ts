/** The fixed set Settings' role picker offers — not user-extensible, so a typo can't silently create a new "role" nobody recognizes. No "server-only" here: the client-side picker (team-roles-section.tsx) needs this list too. */
export const ROLE_OPTIONS = ["Fleet Owner", "Founder", "Lead Developer", "Developer", "Co-host/VA"] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

/** Anyone holding one of these can see and use the Team & Roles admin picker in Settings — checked both in the page (hides the section) and in the server actions below it (so the check isn't just a hidden button away from being bypassed). */
export const DEV_TOOLS_ROLES = new Set<string>(["Founder", "Lead Developer", "Developer"]);

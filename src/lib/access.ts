import "server-only";

/**
 * Whether this deployment requires a signed-in user to see fleet data.
 *
 * HostOS was built as a deliberately public shell (Project Aurora Phase 1):
 * Companion data is host_id-keyed and needs no Google account, so every route
 * rendered signed-out. That is a reasonable choice on localhost.
 *
 * It is NOT reasonable on a public URL. The dashboard shows guest full names,
 * their message threads, license-verification status, vehicle plates and trip
 * schedules — personal data belonging to people who never agreed to publish it.
 * A deployed URL is effectively public: it gets shared, indexed, and forwarded.
 *
 * So the gate defaults ON in production and OFF in development, which keeps the
 * local workflow unchanged while making the hosted app private by default.
 * Set HOSTOS_REQUIRE_AUTH explicitly to override in either direction —
 * "false" is only appropriate for a demo instance carrying no real guest data.
 */
export function requiresAuth(): boolean {
  const raw = process.env.HOSTOS_REQUIRE_AUTH?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV === "production";
}

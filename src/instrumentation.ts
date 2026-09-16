/**
 * Next.js calls `register()` once per server process, before the first
 * request is handled — the only place a configuration problem can be
 * reported *as* a startup error rather than as a confusing 500 (or, worse,
 * a page that renders empty and looks like it simply has no data).
 *
 * Deliberately non-fatal: HostOS is designed to degrade to a read-only shell
 * with honest empty states, and refusing to boot would leave an operator with
 * no UI in which to see what is wrong.
 */
export async function register(): Promise<void> {
  // The edge runtime shares this entry point but not `server-only` modules.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { reportEnvOnStartup } = await import("@/lib/env");
  reportEnvOnStartup();
}

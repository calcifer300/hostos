import { isWorkspaceModule, type WorkspaceModule } from "@/lib/modules";
import { routes } from "@/lib/routes";

/**
 * Where each vertical lives and how the shell tells which one is in focus.
 * Client-safe: no imports beyond the registry and the route table.
 */

/** Which vertical the shell is focused on, per browser (set by chooseVertical). */
export const VERTICAL_COOKIE = "hostos_vertical";

export const VERTICAL_ROUTES: Record<WorkspaceModule, string> = {
  fleet: routes.fleet,
  restaurants: routes.restaurants,
  commerce: routes.commerce,
  web: routes.web,
  cafe: routes.cafe,
  salon: routes.salon,
  custom: routes.custom,
};

/** Pages that belong to one vertical even though they don't sit under its dashboard path. */
const PATH_OWNERS: [RegExp, WorkspaceModule][] = [
  [/^\/app\/(fleet|board|operations|reservations|messages|inbox|risk|library|insights|automations)(\/|$)/, "fleet"],
  [/^\/app\/restaurants(\/|$)/, "restaurants"],
  [/^\/app\/commerce(\/|$)/, "commerce"],
  [/^\/app\/web(\/|$)/, "web"],
  [/^\/app\/cafe(\/|$)/, "cafe"],
  [/^\/app\/salon(\/|$)/, "salon"],
  [/^\/app\/custom(\/|$)/, "custom"],
];

/** The vertical a pathname belongs to, or null for shared pages (Home, tasks, settings…). */
export function verticalFromPath(pathname: string): WorkspaceModule | null {
  for (const [re, m] of PATH_OWNERS) if (re.test(pathname)) return m;
  return null;
}

export function asVertical(value: string | null | undefined): WorkspaceModule | null {
  return value && isWorkspaceModule(value) ? value : null;
}

import { redirect } from "next/navigation";
import { getAccessibleModules, getChosenVertical } from "@/lib/host/context";
import { routes } from "@/lib/routes";
import { VERTICAL_ROUTES } from "@/lib/verticals";

/**
 * The product root. Middleware already redirects this URL (see
 * productHomeRedirect) so sign-in never renders it. This remains for any
 * request that skips middleware: the chosen vertical's dashboard, or the
 * chooser. The cross-business overview lives at /app/overview and is never
 * the default — a Turo dashboard must not carry DoorDash tools.
 */
export default async function AppRoot() {
  const modules = await getAccessibleModules();
  const chosen = await getChosenVertical(modules);
  redirect(chosen ? VERTICAL_ROUTES[chosen] : routes.start);
}

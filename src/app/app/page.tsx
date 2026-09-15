import { redirect } from "next/navigation";
import { getChosenVertical, getCurrentHostId } from "@/lib/host/context";
import { getHostModules } from "@/lib/host/queries";
import { routes } from "@/lib/routes";
import { VERTICAL_ROUTES } from "@/lib/verticals";

/**
 * The product root. Whatever vertical this browser chose on /app/start is the
 * command center it lands on; with nothing chosen yet, the chooser. The
 * cross-business overview lives at /app/overview and is never the default —
 * a Turo dashboard must not carry DoorDash tools.
 */
export default async function AppRoot() {
  const hostId = await getCurrentHostId();
  const modules = await getHostModules(hostId);
  const chosen = await getChosenVertical(modules);
  redirect(chosen ? VERTICAL_ROUTES[chosen] : routes.start);
}

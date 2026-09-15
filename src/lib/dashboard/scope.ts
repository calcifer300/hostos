import type { DashboardScope } from "@/lib/dashboard/widgets";

/**
 * Which line of business a shared record belongs to, so each dashboard's
 * Tasks, Notifications and Recent events show only its own — and Home shows
 * everything. Records the classifiers can't place (a team change, a Butler
 * briefing) belong to every dashboard.
 *
 * Pure and client-safe; tested in tests/dashboard-scope.test.ts.
 */

const TASK_KIND_SCOPE: Record<string, DashboardScope> = {
  trip: "fleet",
  messages: "fleet",
  message: "fleet",
  vehicle: "fleet",
  reservation: "fleet",
  restaurant: "restaurants",
  menu: "restaurants",
  order: "restaurants",
  store: "commerce",
  product: "commerce",
  commerce_order: "commerce",
  web_property: "web",
  cafe_location: "cafe",
  cafe_stock: "cafe",
  cafe_sales: "cafe",
  salon_location: "salon",
  salon_client: "salon",
  appointment: "salon",
  custom_metric: "custom",
  build_request: "custom",
  service_job: "services",
  service_estimate: "services",
  service_customer: "services",
};

const NOTIFICATION_KIND_SCOPE: Record<string, DashboardScope> = {
  trip: "fleet",
  message: "fleet",
  alert: "fleet",
  restaurant: "restaurants",
  order: "restaurants",
  store: "commerce",
  web: "web",
  cafe: "cafe",
  salon: "salon",
  custom: "custom",
  services: "services",
};

const ACTIVITY_MODULE_SCOPE: Record<string, DashboardScope> = {
  fleet: "fleet",
  restaurant: "restaurants",
  commerce: "commerce",
  web: "web",
  cafe: "cafe",
  salon: "salon",
  custom: "custom",
  services: "services",
};

export function taskScope(task: { relatedKind: string | null; href?: string | null }): DashboardScope | null {
  if (task.relatedKind && TASK_KIND_SCOPE[task.relatedKind]) return TASK_KIND_SCOPE[task.relatedKind];
  return scopeFromHref(task.href ?? null);
}

export function notificationScope(n: { kind: string; href?: string | null }): DashboardScope | null {
  return NOTIFICATION_KIND_SCOPE[n.kind] ?? scopeFromHref(n.href ?? null);
}

export function activityScope(a: { module: string; href?: string | null }): DashboardScope | null {
  return ACTIVITY_MODULE_SCOPE[a.module] ?? scopeFromHref(a.href ?? null);
}

/** A last resort: the page a record links to says which business it is about. */
export function scopeFromHref(href: string | null): DashboardScope | null {
  if (!href) return null;
  const path = href.replace(/^https?:\/\/[^/]+/, "");
  if (/^\/app\/(commerce)(\/|$|\?)/.test(path)) return "commerce";
  if (/^\/app\/(web)(\/|$|\?)/.test(path)) return "web";
  if (/^\/app\/(cafe)(\/|$|\?)/.test(path)) return "cafe";
  if (/^\/app\/(salon)(\/|$|\?)/.test(path)) return "salon";
  if (/^\/app\/(custom)(\/|$|\?)/.test(path)) return "custom";
  if (/^\/app\/(restaurants)(\/|$|\?)/.test(path)) return "restaurants";
  if (/^\/app\/(fleet|board|operations|messages|reservations|risk|inbox|library)(\/|$|\?)/.test(path)) return "fleet";
  return null;
}

/** Home shows everything; a line-of-business dashboard shows its own plus the unplaceable. */
export function inScope(dashboard: DashboardScope, recordScope: DashboardScope | null): boolean {
  if (dashboard === "home") return true;
  return recordScope === null || recordScope === dashboard;
}

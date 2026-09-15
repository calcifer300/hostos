/**
 * Pure helpers for the Service Businesses vertical — shared by server
 * queries, the dashboard widgets and the Butler. No imports, no I/O.
 */

export type JobStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
export type JobKind = "job" | "estimate" | "inspection" | "follow_up" | "installation" | "maintenance";
export type JobPriority = "low" | "normal" | "high" | "urgent";
export type EstimateStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
export type CustomerStage = "lead" | "customer" | "inactive";
export type StaffRole = "technician" | "dispatcher" | "manager" | "va" | "owner";
export type EventKind = "note" | "call" | "sms" | "email" | "whatsapp" | "messenger" | "status";

export const JOB_STATUSES: JobStatus[] = ["pending", "assigned", "in_progress", "completed", "cancelled"];
export const JOB_KINDS: JobKind[] = ["job", "estimate", "inspection", "follow_up", "installation", "maintenance"];
export const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];
export const ESTIMATE_STATUSES: EstimateStatus[] = ["draft", "sent", "accepted", "declined", "expired"];
export const STAFF_ROLES: StaffRole[] = ["technician", "dispatcher", "manager", "va", "owner"];
export const EVENT_KINDS: EventKind[] = ["note", "call", "sms", "email", "whatsapp", "messenger", "status"];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = { pending: "Pending", assigned: "Assigned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
export const JOB_KIND_LABEL: Record<JobKind, string> = { job: "Job", estimate: "Estimate visit", inspection: "Inspection", follow_up: "Follow-up", installation: "Installation", maintenance: "Maintenance" };
export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined", expired: "Expired" };
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { technician: "Technician", dispatcher: "Dispatcher", manager: "Manager", va: "Virtual Assistant", owner: "Owner" };
export const EVENT_KIND_LABEL: Record<EventKind, string> = { note: "Note", call: "Call", sms: "SMS", email: "Email", whatsapp: "WhatsApp", messenger: "Messenger", status: "Status" };

export const asJobStatus = (v: unknown): JobStatus => (JOB_STATUSES as string[]).includes(String(v)) ? (v as JobStatus) : "pending";
export const asJobKind = (v: unknown): JobKind => (JOB_KINDS as string[]).includes(String(v)) ? (v as JobKind) : "job";
export const asJobPriority = (v: unknown): JobPriority => (JOB_PRIORITIES as string[]).includes(String(v)) ? (v as JobPriority) : "normal";
export const asEstimateStatus = (v: unknown): EstimateStatus => (ESTIMATE_STATUSES as string[]).includes(String(v)) ? (v as EstimateStatus) : "draft";
export const asStaffRole = (v: unknown): StaffRole => (STAFF_ROLES as string[]).includes(String(v)) ? (v as StaffRole) : "technician";
export const asEventKind = (v: unknown): EventKind => (EVENT_KINDS as string[]).includes(String(v)) ? (v as EventKind) : "note";

export interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Material {
  name: string;
  quantity: number;
  cost: number;
}

export interface JobPhoto {
  url: string;
  caption: string | null;
  phase: "before" | "after" | "other";
}

export function estimateTotals(items: LineItem[], taxRate: number): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const tax = subtotal * ((Number(taxRate) || 0) / 100);
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A job is open while it is neither completed nor cancelled. */
export const isOpen = (status: JobStatus): boolean => status !== "completed" && status !== "cancelled";

/** Scheduled to have ended, still open. */
export function isOverdue(job: { status: JobStatus; scheduledEnd: string | null }, now = Date.now()): boolean {
  if (!isOpen(job.status) || !job.scheduledEnd) return false;
  const end = Date.parse(job.scheduledEnd);
  return Number.isFinite(end) && end < now;
}

export const sameDay = (iso: string | null, day: string): boolean => Boolean(iso && iso.slice(0, 10) === day);

/** Two scheduled windows for the same technician overlap. */
export function conflicts(a: { staffId: string | null; scheduledStart: string | null; scheduledEnd: string | null }, b: { staffId: string | null; scheduledStart: string | null; scheduledEnd: string | null }): boolean {
  if (!a.staffId || a.staffId !== b.staffId) return false;
  if (!a.scheduledStart || !a.scheduledEnd || !b.scheduledStart || !b.scheduledEnd) return false;
  return Date.parse(a.scheduledStart) < Date.parse(b.scheduledEnd) && Date.parse(b.scheduledStart) < Date.parse(a.scheduledEnd);
}

/** Estimates sent more than `days` ago with no decision. */
export function needsFollowUp(e: { status: EstimateStatus; sentAt: string | null }, days = 2, now = Date.now()): boolean {
  if (e.status !== "sent" || !e.sentAt) return false;
  return now - Date.parse(e.sentAt) > days * 86_400_000;
}

/** Completed jobs with no "after" photo — the review request has nothing to show. */
export function missingPhotos(job: { status: JobStatus; photos: JobPhoto[] }): boolean {
  return job.status === "completed" && !job.photos.some((p) => p.phase === "after");
}

export interface StaffStats {
  staffId: string;
  completed: number;
  cancelled: number;
  revenue: number;
  completionRate: number | null;
}

export function staffStats(jobs: { staffId: string | null; status: JobStatus; price: number | null }[]): StaffStats[] {
  const by = new Map<string, StaffStats>();
  for (const j of jobs) {
    if (!j.staffId) continue;
    const s = by.get(j.staffId) ?? { staffId: j.staffId, completed: 0, cancelled: 0, revenue: 0, completionRate: null };
    if (j.status === "completed") {
      s.completed += 1;
      s.revenue += Number(j.price) || 0;
    } else if (j.status === "cancelled") s.cancelled += 1;
    by.set(j.staffId, s);
  }
  for (const s of by.values()) {
    const total = s.completed + s.cancelled;
    s.completionRate = total > 0 ? Math.round((s.completed / total) * 100) : null;
    s.revenue = round2(s.revenue);
  }
  return [...by.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface RevenueSummary {
  today: number;
  month: number;
  completedToday: number;
  completedMonth: number;
  averageJobValue: number | null;
  cancellationRate: number | null;
}

export function revenueSummary(jobs: { status: JobStatus; price: number | null; completedAt: string | null; createdAt: string }[], now = new Date()): RevenueSummary {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  let today = 0;
  let monthTotal = 0;
  let completedToday = 0;
  let completedMonth = 0;
  let cancelled = 0;
  let decided = 0;
  for (const j of jobs) {
    if (j.status === "completed" && j.completedAt) {
      const price = Number(j.price) || 0;
      if (j.completedAt.slice(0, 10) === day) {
        today += price;
        completedToday += 1;
      }
      if (j.completedAt.slice(0, 7) === month) {
        monthTotal += price;
        completedMonth += 1;
      }
    }
    if (j.status === "completed" || j.status === "cancelled") {
      decided += 1;
      if (j.status === "cancelled") cancelled += 1;
    }
  }
  return {
    today: round2(today),
    month: round2(monthTotal),
    completedToday,
    completedMonth,
    averageJobValue: completedMonth > 0 ? round2(monthTotal / completedMonth) : null,
    cancellationRate: decided > 0 ? Math.round((cancelled / decided) * 100) : null,
  };
}

/** Lead → customer conversion over the customers on file. */
export function leadConversion(customers: { stage: CustomerStage }[]): number | null {
  const leads = customers.filter((c) => c.stage === "lead").length;
  const won = customers.filter((c) => c.stage === "customer").length;
  const total = leads + won;
  return total > 0 ? Math.round((won / total) * 100) : null;
}

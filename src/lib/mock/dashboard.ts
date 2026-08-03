/**
 * Stand-ins for what the Fleet, Reservations, and Activity connectors will
 * deliver once they're built (see README "What's real vs staged" — same
 * pattern as seed-emails.ts). The Home briefing renders this shape today;
 * swapping the source later changes how these objects are produced, not
 * the dashboard components that render them.
 */

export type VehicleStatus = "on_trip" | "available" | "cleaning" | "maintenance";

export interface FleetVehicle {
  id: string;
  name: string;
  plate: string;
  status: VehicleStatus;
  location: string;
  rating: number;
  tripsThisMonth: number;
}

export const fleetVehicles: FleetVehicle[] = [
  { id: "v1", name: "Tesla Model 3", plate: "8LFX291", status: "on_trip", location: "SFO Long-Term", rating: 4.98, tripsThisMonth: 11 },
  { id: "v2", name: "Honda CR-V", plate: "7KTM045", status: "available", location: "Downtown Lot B", rating: 4.91, tripsThisMonth: 9 },
  { id: "v3", name: "Jeep Wrangler", plate: "9DGP773", status: "cleaning", location: "Mission St Garage", rating: 4.87, tripsThisMonth: 14 },
  { id: "v4", name: "BMW 3 Series", plate: "6HNC128", status: "on_trip", location: "SFO Long-Term", rating: 4.95, tripsThisMonth: 8 },
  { id: "v5", name: "Toyota Camry", plate: "2WBR509", status: "maintenance", location: "Sunset Auto Care", rating: 4.89, tripsThisMonth: 6 },
  { id: "v6", name: "Ford Mustang", plate: "4RXK662", status: "available", location: "Downtown Lot B", rating: 4.93, tripsThisMonth: 12 },
];

export interface FleetHealth {
  score: number;
  scoreDelta: number;
  activeTrips: number;
  needsAttention: number;
  avgResponseMinutes: number;
  upcomingMaintenance: number;
}

export const fleetHealth: FleetHealth = {
  score: 94,
  scoreDelta: 2,
  activeTrips: 2,
  needsAttention: 2,
  avgResponseMinutes: 6,
  upcomingMaintenance: 1,
};

export interface ScheduleEntry {
  id: string;
  kind: "pickup" | "return";
  guestName: string;
  vehicle: string;
  time: string;
  location: string;
  ready: boolean;
}

export const todaysPickups: ScheduleEntry[] = [
  { id: "p1", kind: "pickup", guestName: "Andrew Chen", vehicle: "Tesla Model 3", time: "10:00 AM", location: "SFO Long-Term", ready: true },
  { id: "p2", kind: "pickup", guestName: "Priya Nair", vehicle: "Ford Mustang", time: "1:30 PM", location: "Downtown Lot B", ready: true },
  { id: "p3", kind: "pickup", guestName: "Marcus Lee", vehicle: "Jeep Wrangler", time: "5:00 PM", location: "Mission St Garage", ready: false },
];

export const todaysReturns: ScheduleEntry[] = [
  { id: "r1", kind: "return", guestName: "Leslie Park", vehicle: "Honda CR-V", time: "11:15 AM", location: "Downtown Lot B", ready: true },
  { id: "r2", kind: "return", guestName: "Douglas Reyes", vehicle: "BMW 3 Series", time: "4:45 PM", location: "SFO Long-Term", ready: true },
];

export type MessageUrgency = "high" | "medium" | "low";

export interface AttentionMessage {
  id: string;
  guestName: string;
  vehicle: string;
  preview: string;
  urgency: MessageUrgency;
  receivedAgo: string;
}

export const messagesNeedingAttention: AttentionMessage[] = [
  { id: "m1", guestName: "Andrew Chen", vehicle: "Tesla Model 3", preview: "Could we get to the car by 10am instead of 1pm?", urgency: "high", receivedAgo: "8m ago" },
  { id: "m2", guestName: "Sofia Marin", vehicle: "Toyota Camry", preview: "Is the Camry still okay to book for next weekend given the shop visit?", urgency: "medium", receivedAgo: "41m ago" },
  { id: "m3", guestName: "Marcus Lee", vehicle: "Jeep Wrangler", preview: "Just confirming the lockbox code will come by text, not email.", urgency: "low", receivedAgo: "2h ago" },
];

export type ActivityKind = "booking" | "message" | "payment" | "review" | "maintenance";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  description: string;
  timeAgo: string;
}

export const recentActivity: ActivityEntry[] = [
  { id: "a1", kind: "review", description: "Douglas left a 5-star review for the BMW 3 Series", timeAgo: "24m ago" },
  { id: "a2", kind: "payment", description: "Payout of $612.40 deposited for last week's trips", timeAgo: "1h ago" },
  { id: "a3", kind: "booking", description: "New booking: Priya Nair, Ford Mustang, Aug 3–6", timeAgo: "3h ago" },
  { id: "a4", kind: "message", description: "iHost auto-replied to Leslie's early check-in question", timeAgo: "5h ago" },
  { id: "a5", kind: "maintenance", description: "Toyota Camry checked in for scheduled service", timeAgo: "Yesterday" },
];

export type SuggestionPriority = "high" | "medium" | "low";

export interface AiSuggestion {
  id: string;
  title: string;
  description: string;
  priority: SuggestionPriority;
  actionLabel: string;
}

export const aiSuggestions: AiSuggestion[] = [
  { id: "s1", title: "Approve Andrew's early pickup", description: "No back-to-back booking on the Model 3 before 10am — safe to approve.", priority: "high", actionLabel: "Review reply" },
  { id: "s2", title: "Block Tuesday for the Camry", description: "Service is running long. Blocking the calendar now avoids a same-day cancellation.", priority: "medium", actionLabel: "Block dates" },
  { id: "s3", title: "Nudge for a review", description: "Marcus's trip ended 2 days ago with no review yet — a gentle nudge tends to convert.", priority: "low", actionLabel: "Send nudge" },
];

export interface TimelineEvent {
  id: string;
  time: string;
  sortKey: number;
  kind: "pickup" | "return" | "message" | "maintenance";
  title: string;
  subtitle: string;
}

export const todaysTimeline: TimelineEvent[] = [
  { id: "t1", time: "10:00 AM", sortKey: 600, kind: "pickup", title: "Andrew Chen · Tesla Model 3", subtitle: "SFO Long-Term" },
  { id: "t2", time: "11:15 AM", sortKey: 675, kind: "return", title: "Leslie Park · Honda CR-V", subtitle: "Downtown Lot B" },
  { id: "t3", time: "1:30 PM", sortKey: 810, kind: "pickup", title: "Priya Nair · Ford Mustang", subtitle: "Downtown Lot B" },
  { id: "t4", time: "2:00 PM", sortKey: 840, kind: "maintenance", title: "Toyota Camry · Service pickup", subtitle: "Sunset Auto Care" },
  { id: "t5", time: "4:45 PM", sortKey: 885, kind: "return", title: "Douglas Reyes · BMW 3 Series", subtitle: "SFO Long-Term" },
  { id: "t6", time: "5:00 PM", sortKey: 900, kind: "pickup", title: "Marcus Lee · Jeep Wrangler", subtitle: "Mission St Garage — cleaning not yet done" },
];

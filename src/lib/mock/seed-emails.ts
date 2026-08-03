import type { InboundTuroEmail } from "@/types/ihost";

/**
 * These stand in for what a real Gmail Connector would deliver once
 * Gmail push notifications are wired up. That connector is not built
 * in v0.1 — see README "What's real vs staged." The shape here is
 * exactly what a real webhook payload would be normalized into, so
 * swapping the source later changes how InboundTuroEmail objects are
 * produced, not anything downstream (POST /api/ihost/analyze and
 * everything after it is unaffected).
 */
export const seedEmails: InboundTuroEmail[] = [
  {
    guestName: "Andrew",
    vehicle: "Tesla Model 3",
    subject: "Question about pickup time",
    body: "Hi! Quick question - our flight lands early tomorrow and we could get to the car by 10am instead of 1pm. Any chance we could pick up earlier? Also just wanted to check the lockbox code will be sent to this email?",
    receivedAt: new Date().toISOString(),
  },
  {
    guestName: "Leslie",
    vehicle: "Honda CR-V",
    subject: "Trip starts tomorrow",
    body: "Hey, is early check-in possible? We land at noon and the reservation says 4pm pickup. Would love to grab it sooner if the car's ready.",
    receivedAt: new Date().toISOString(),
  },
  {
    guestName: "Douglas",
    vehicle: "Jeep Wrangler",
    subject: "Verification complete",
    body: "Turo notification: Douglas's driver's license has been verified and the trip is confirmed to begin as scheduled.",
    receivedAt: new Date().toISOString(),
  },
];

export const defaultKnowledgeBase = {
  checkInProcess:
    "Guests receive a 4-digit lockbox code by email 2 hours before their scheduled pickup time. The car is parked in the numbered spot matching the reservation.",
  houseRules:
    "Early check-in is allowed only if the vehicle has no cleaning or turnaround scheduled before the new time. Cleaning takes 90 minutes minimum after the prior return.",
  policy:
    "Extensions are granted if no back-to-back booking exists. No same-day refunds outside platform policy.",
  tone: "Warm but efficient. Straightforward. Never salesy.",
};

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

/**
 * Fallback knowledge base, used when a host hasn't saved their own on the
 * Knowledge page. This mirrors the real operating policy of the host this
 * build was developed against, so drafted replies are grounded in something
 * true rather than in invented placeholder rules.
 *
 * Access credentials are deliberately absent — lockbox codes, key cards, and
 * Tesla access links are issued per trip and must never live in source.
 */
export const defaultKnowledgeBase = {
  checkInProcess:
    "Pickup instructions and parking details are sent approximately 24 hours before the trip starts. Key access instructions are sent about 1 hour before the scheduled start time. Before pickup the guest must upload a driver's license and a selfie holding that license in the Trip Details section of the Turo app (not a browser). Keys are not released until verification is complete. The primary driver on the reservation must be the person who picks up the vehicle.",
  houseRules:
    "Smoke-free vehicle. No off-roading. Additional drivers are free but must be approved through Turo before driving, and they may not pick up or drop off the vehicle — only the primary driver can. If someone else needs to collect the car, the trip must be cancelled and rebooked in that person's name. Extras are available including prepaid refueling/EV charging, infant seats, booster seats, camp chairs, strollers, pack-and-plays, and ski racks. Teslas must be returned at 80% charge or higher, and the backup key card must be returned to the vehicle before the trip ends.",
  policy:
    "Trip changes must be submitted as a modification request in the Turo app as early as possible so the reservation stays covered. Hosts cannot change billing, approve additional drivers, or modify trips — those go to Turo Support at 415-965-4525. Tolls: the vehicle carries a toll pass, the guest is responsible for tolls incurred, and a reimbursement invoice is sent through the Turo app after the trip. There is no HOV pass. Toll reimbursements are only ever processed through the Turo app — texts claiming unpaid toll fees (often referencing E-470) are a phishing scam and must not be paid. Colorado Express Lanes are strictly enforced: enter and exit only at designated access points, never cross double white lines, $75 per violation and generally not waived. Mileage included is 1000 miles; guests travelling more than 400 miles one way from Denver should notify the host beforehand so roadside assistance and long-distance procedures can be shared. Adding the Prepaid EV Recharge extra before the trip starts enables Supervised Full Self-Driving for the trip and allows return without a final charging stop; it is not enabled if the extra is added late.",
  tone: "Warm, friendly, and thorough. Opens with a greeting and a thank-you, uses emoji as section markers (👋 ⚠️ 📅 🚭 🎁 📞), and is comfortable with exclamation points. Organizes longer messages into short labelled sections rather than paragraphs. Direct about rules and enforcement without being cold. Signs off with a send-off like 'Drive safely and enjoy your trip! 🚗✨'.",
};

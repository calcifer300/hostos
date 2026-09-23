/**
 * Copy/paste guest message library — straight from Colorado Cruisers' VA
 * Operations Handbook (section 12), not AI-generated. HostOS doesn't send
 * Turo messages itself (Turo stays the source of truth for guest
 * communication — see PROJECT_STATE), so these exist to be copied and
 * pasted into Turo's own reply box rather than sent from here.
 */
export interface ReplyTemplate {
  id: string;
  label: string;
  /** {guestName} and {vehicle} are substituted from the real conversation before copying. */
  body: string;
}

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "booking-welcome",
    label: "Booking welcome",
    body: "Thanks for booking the {vehicle} with Colorado Cruisers. We'll send your pickup details before the trip. Please complete Turo's required ID verification early so vehicle access is not delayed. If you'll be traveling more than 400 miles one way from Denver, let us know in advance so we can share the appropriate roadside and emergency guidance.",
  },
  {
    id: "pickup-location",
    label: "Pickup location clarification",
    body: "Your pickup is at Park2Jet near DIA, not the terminal garage. Park2Jet provides a 24/7 airport shuttle, and you'll go directly to the vehicle without a rental-counter line. We cover the Park2Jet parking charge.",
  },
  {
    id: "return-location",
    label: "Return location clarification",
    body: "Please return the vehicle to Park2Jet, 18121 E 81st Ave, Denver, CO 80022, following the parking instructions in your trip message. DIA terminal/short-term garage return is not approved unless we specifically confirm an exception.",
  },
  {
    id: "ev-return-reminder",
    label: "EV return reminder",
    body: "Reminder for your {vehicle} return: please return around 80% or the pickup charge level shown for your trip. If you purchased the Prepaid EV Extra, 30+ miles remaining is sufficient. Please complete Turo checkout and include a battery-level photo.",
  },
  {
    id: "complaint-ack",
    label: "Guest complaint acknowledgment",
    body: "I'm sorry for the frustration, {guestName}. I want to make sure we handle this correctly. Please send photos/details/location, and I'll have this reviewed right away. I don't want to give you an incorrect answer before we confirm the details.",
  },
];

export function renderReplyTemplate(template: ReplyTemplate, vars: { guestName: string; vehicle: string }): string {
  return template.body.replaceAll("{guestName}", vars.guestName).replaceAll("{vehicle}", vars.vehicle);
}

/**
 * The host's real guest-facing message templates.
 *
 * These are the messages actually sent today, captured verbatim in structure
 * and voice so automations send the host's words rather than a model's
 * paraphrase of them. `{{placeholders}}` are filled at send time.
 *
 * SECURITY: no template may contain a live credential. Lockbox codes, key
 * cards, and Tesla access links are issued per trip through Turo and are
 * referenced here only as timing promises, never as values. If you find
 * yourself pasting a real code or an access URL into this file, it belongs
 * in the per-trip message instead.
 */

export type TemplateScope = "all" | "tesla";

export interface MessageTemplate {
  id: string;
  name: string;
  /** Which vehicles this applies to. */
  scope: TemplateScope;
  /** When the host sends this today. */
  sendWhen: string;
  body: string;
}

export const TEMPLATE_PLACEHOLDERS = [
  "{{guestName}}",
  "{{vehicle}}",
  "{{startDate}}",
  "{{endDate}}",
] as const;

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "booking_welcome",
    name: "Booking welcome",
    scope: "all",
    sendWhen: "Immediately after a booking is confirmed",
    body: `👋 Thanks for booking with me! I'm looking forward to hosting your trip from {{startDate}} through {{endDate}}.

A few helpful reminders before your trip:

👥 Additional drivers can be added for free through Turo. Please make sure any additional driver is approved in the app before driving.
🔗 https://help.turo.com/en_us/adding-a-driver-to-a-trip-HksENgV5

⚠️ The primary driver on the reservation, {{guestName}}, must be the person who picks up the vehicle. Turo does not allow additional drivers to pick up or drop off the vehicle. The trip would need to be cancelled and rebooked in the name of the person picking up and dropping off.

📅 Pickup instructions and parking details will be sent approximately 24 hours before your trip. You will need to upload your driver's license at that time in Trip Details. Key access instructions will be provided about 1 hour before your scheduled start time.

⏰ If your plans change, please submit a trip modification request through the Turo app as soon as possible to ensure your reservation remains covered.

🚭 This is a smoke-free vehicle. No off-roading.

🎁 Don't forget to check out the available extras, including prepaid refueling/EV charging, infant seats, booster seats, camp chairs, strollers, pack-and-plays, and ski racks.

📞 For billing questions, additional driver approvals, or trip modifications, please contact Turo Support directly at 415-965-4525, as hosts are unable to make those changes.

Thanks again, and have a great trip! 🚗✨`,
  },
  {
    id: "toll_info",
    name: "Toll road information",
    scope: "all",
    sendWhen: "Shortly after booking, alongside the welcome message",
    body: `👋 Thanks for booking the vehicle!

🎥 Toll road information video (copy and paste into your browser):
https://youtube.com/shorts/mB4VU9d_ZHw?si=qhd3POCYQRYgElvJ

🛣️ You are welcome to use toll roads during your trip. The vehicle is equipped with a toll pass, and you will be responsible for any toll charges incurred. A reimbursement invoice will be sent through the Turo app after your trip.

🚫 Please note that this vehicle does not have an HOV pass.

⚠️ Important: There is an ongoing phishing scam involving text messages claiming you owe toll fees (often referencing E-470). Please do not pay any toll-related requests received via text message. All toll reimbursements for your trip will be processed exclusively through the Turo app.

🚨 Colorado Express Lanes have strict enforcement rules. Only enter and exit at designated access points, and never cross double white lines. Violations carry a $75 penalty per occurrence and are generally not waived.

Drive safely and enjoy your trip! 🚗✨`,
  },
  {
    id: "id_verification",
    name: "ID verification required",
    scope: "all",
    sendWhen: "Before pickup, when verification is still outstanding",
    body: `⚠️ ID Verification Required Before Pickup

The primary driver on this reservation is {{guestName}} and must be the person picking up the vehicle.

📸 Please upload the following in the Trip Details section — please use the Turo app, not a browser.
• Driver's license
• Selfie holding driver's license

https://help.turo.com/en_us/trip-check-in-guide-guests-HkZfVVe49

❌ Keys cannot be released until verification is completed.

✅ This helps confirm that the person picking up the vehicle matches the reservation and meets Turo's verification requirements.

⏱️ Completing this step early helps avoid delays and ensures a smooth pickup experience.

🙏 Thank you for your cooperation!`,
  },
  {
    id: "long_distance_check",
    name: "Long-distance travel check",
    scope: "all",
    sendWhen: "Early in the trip conversation, to surface long hauls",
    body: `Traveling more than 400 miles one way from Denver?

Please let us know before your trip so we can share important information about roadside assistance, emergency support, long-distance travel procedures, and your included mileage of 1000 miles.

This helps ensure you're prepared if anything unexpected happens while you're away.`,
  },
  {
    id: "tesla_prepaid_ev_tip",
    name: "Tesla — Prepaid EV extra",
    scope: "tesla",
    sendWhen: "After booking a Tesla, before the trip starts",
    body: `⚡ Tesla Tip

🎁 Bonus: Add the Prepaid EV Recharge Extra before your trip begins and enjoy Supervised Full Self-Driving for your entire trip, including Auto Lane Change, Autopark, Smart Summon, and additional highway-driving assistance.

The Prepaid EV Recharge Extra also lets you return the vehicle without making a final charging stop before drop-off.

A typical Supercharger session costs around $30 and takes about 30 minutes, so this extra saves you time, money, and includes Supervised Full Self-Driving — all while letting you return the vehicle at 10 percent charge or higher. It also helps you avoid low-battery, convenience, and battery-level difference fees.

To add it, open the Turo app and select "Change trip", navigate to extras and add.

If it is not added, Supervised Full Self-Driving will not be enabled.`,
  },
  {
    id: "tesla_charging_guide",
    name: "Tesla — charging and trip guide",
    scope: "tesla",
    sendWhen: "Before a Tesla trip starts",
    body: `⚡ Thanks for booking the {{vehicle}}! Here's everything you need for a smooth trip.

📱 Unlock & Lock
I'll add your phone number to the Tesla app before pickup. Once connected:
• Open the Tesla app (the car is named after a reindeer 🦌)
• Use Controls to lock/unlock and access features
• Use Location to find the vehicle

🔋 Charging (Supercharging)
• Enter your destination in Tesla Navigation
• The car will automatically route you to Superchargers if needed
• Plug in and charging starts automatically
• Charging costs are billed to my account and invoiced after the trip

🏠 Overnight Charging
• Charging cable is in the trunk storage compartment
• Plug into a standard wall outlet for ~3–5 miles/hour
• Adapter for other charging stations is in the center console

🔋 Return Charge
Please return the vehicle at 80%+ charge per Turo rules. Charging to 100% during your trip is fine.

❄️ AWD + Snow
This Tesla is AWD and performs well in snow with all-season tires.

🆘 Help / Issues
If anything comes up, start with Tesla or Turo Roadside Assistance and message me so I can help coordinate.

Tesla Roadside: https://www.tesla.com/support/roadside-assistance
Turo Roadside: https://help.turo.com/roadside-assistance-for-guests-or-us-and-canada-BJBiEVgE9`,
  },
  {
    id: "tesla_app_setup",
    name: "Tesla — app setup and access",
    scope: "tesla",
    sendWhen: "About 1 hour before a Tesla trip starts, with the access link",
    body: `⚡ Tesla App Setup & Access Guide

📲 Step 1: Accept Access
Click the access link sent in Turo messages and accept the invitation to connect your Tesla account.

🦌 Step 2: Confirm Connection
All of our Teslas are named after reindeer. If you see the vehicle listed in your Tesla app under that name, you're successfully connected.

🔓 Step 3: Unlock the Vehicle
Use the Tesla app (not a browser) when you arrive at the car.
• Tap "Unlock" a few times if needed — it may take a couple of attempts to respond

📱 Step 4: Phone Pairing
Once inside, the app will prompt you to pair your phone with the vehicle. Follow the on-screen instructions to complete setup.

🔑 Backup Key Card
A key card is located in the glove box or center console for valet or additional driver use.

⚠️ Please make sure the key card is returned to the vehicle before the end of your trip.

Let me know if you need any help getting connected 🚗⚡`,
  },
];

export function getTemplate(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find((t) => t.id === id);
}

/** Fills {{placeholders}}; unknown keys are left untouched so gaps are visible. */
export function renderTemplate(
  template: MessageTemplate,
  values: Partial<Record<"guestName" | "vehicle" | "startDate" | "endDate", string>>
): string {
  return template.body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key as keyof typeof values];
    return value ?? match;
  });
}

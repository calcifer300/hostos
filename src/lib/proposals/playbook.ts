/**
 * The pricing positioning playbook — INTERNAL ONLY.
 *
 * This is the part of the proposal the client never sees: how each price is
 * argued. It exists because the proposal tells a client what something
 * costs, and that is a different job from teaching our own team why it costs
 * that and how to say so without flinching.
 *
 * The rules it teaches:
 *   1. Never lead with the number. Lead with what it replaces.
 *   2. Anchor against the real alternative, not against nothing.
 *   3. Sell the outcome, quote the scope.
 *   4. A discount is a scope change, never a favor.
 *
 * Rendered in the internal print document and never in the client's shared
 * view. It is deliberately not part of ProposalDoc: it is not per-client.
 */

export interface PositioningEntry {
  /** The service, as the pricing section names it. */
  service: string;
  price: string;
  /** What the client is really comparing us to. */
  anchor: string;
  /** The one sentence that frames the price before the number is said. */
  frame: string;
  /** What to say, close to verbatim. */
  say: string[];
  /** What loses the deal. */
  avoid: string[];
  /** The objection this price always attracts, and the answer. */
  objection: { q: string; a: string };
}

export interface PlaybookRule {
  name: string;
  body: string;
}

export const PRICING_RULES: PlaybookRule[] = [
  {
    name: "Never lead with the number",
    body: "The price is the last thing you say in the sentence, not the first. Name what it replaces, what it returns, and what it costs them to keep doing it the current way. The number should land as the cheap option, because by then it is.",
  },
  {
    name: "Anchor against the real alternative",
    body: "Nobody buys in a vacuum. Every client is silently comparing us to a local hire, a freelancer, or doing nothing. Name the alternative yourself and price against it out loud. Unanchored numbers always sound expensive.",
  },
  {
    name: "Sell the outcome, quote the scope",
    body: "We sell what changes in the business. We quote what we will do. Keep them in that order and in different sentences — outcome first, scope second — or the conversation turns into a line-item negotiation.",
  },
  {
    name: "A discount is a scope change",
    body: "We never take money off for the same work; that tells them the first number was invented. If the budget is smaller, the scope gets smaller — fewer hours, fewer automations, a narrower vertical. Same rate, less of it.",
  },
  {
    name: "Custom work is never a number on a call",
    body: "Scope, integrations, complexity and timeline decide it. Give the floor so they can plan, then quote after discovery. Guessing high loses the deal; guessing low costs us the project.",
  },
  {
    name: "Always price the cost of waiting",
    body: "Every month they delay has a number: the missed claims, the unanswered leads, the owner's sixty hours. Put that number next to ours. The comparison is not price versus zero, it is price versus what the gap already costs.",
  },
];

export const POSITIONING: PositioningEntry[] = [
  {
    service: "Business Operations — Starter",
    price: "$1,490/mo",
    anchor: "A part-time local hire at $2,000–2,500/mo, or a freelancer at $800 with no cover and no procedures.",
    frame: "This is one trained operator, on your hours, with the procedures written down and the software included — for less than a part-time local hire costs before benefits.",
    say: [
      "“For the price of a part-time admin you get a trained operator, the written procedures, and the board it all runs on.”",
      "“The freelancer is cheaper until they are sick, and then you are the backup.”",
      "“You are not paying for hours. You are paying for the work to happen the same way every time.”",
    ],
    avoid: [
      "Do not call it “entry level” — it is the right tier for a solo operator and should sound deliberate.",
      "Do not compare it to offshore hourly rates. That invites a race to the bottom we do not want to win.",
    ],
    objection: {
      q: "“I can get a VA for $600 a month.”",
      a: "“You can. What you cannot get for $600 is cover when they are off, procedures written for your business, quality checks on their conversations, and software to work from. You would be buying a person; this is buying the operation running.”",
    },
  },
  {
    service: "Business Operations — Growth",
    price: "$2,890/mo",
    anchor: "One full-time US hire at $3,500–4,500/mo before benefits, who still cannot cover two shifts.",
    frame: "Two operators who cover for each other costs less than one local hire who cannot cover themselves.",
    say: [
      "“One person is a single point of failure. Two is a team, and it still costs less than one hire here.”",
      "“This is the tier where automation starts paying for itself — fifteen automations usually removes 30 to 60 hours of admin a month.”",
      "“Most clients land here because volume, not headcount, is what actually grew.”",
    ],
    avoid: [
      "Do not present it as the ‘middle’ option — present it as the standard, with Starter as the smaller case.",
      "Do not itemize the 5 development hours as if they were the value. They are the proof we build, not the product.",
    ],
    objection: {
      q: "“Why is it nearly double Starter?”",
      a: "“Because it is double the coverage plus cover for time off, three times the automations, and development capacity. Starter is one person’s week. This is an operation that does not stop when someone is ill.”",
    },
  },
  {
    service: "Business Operations — Around the clock",
    price: "$5,900/mo",
    anchor: "A 24/7 rota built locally: three to four hires, $12,000–16,000/mo before management.",
    frame: "Round-the-clock coverage priced at what one and a half local hires cost — because the repetitive hours were automated before anyone was paid to work them.",
    say: [
      "“Nobody can staff 24/7 with one person. Locally this rota is four hires. Here it is a team and a named lead.”",
      "“At this tier the lead operator owns your numbers and sits in a weekly review. You are buying accountability, not availability.”",
      "“If your customers message at 2 AM and get an answer at 9 AM, you are already paying for this — in lost bookings.”",
    ],
    avoid: [
      "Do not discount this tier to win a logo. It is the one where under-pricing shows up as poor coverage three months later.",
      "Do not promise a named individual across all shifts. Coverage is a team; that is the feature.",
    ],
    objection: {
      q: "“That is a lot per month.”",
      a: "“It is, and it is about a third of what the same rota costs locally. Let us put your numbers next to it: what does a missed night of messages cost you, times thirty?”",
    },
  },
  {
    service: "Web Development",
    price: "$1,900 – $4,500 one-time",
    anchor: "US agencies at $5,000–15,000 for the same brief; template builders at $500 that leave them with a template.",
    frame: "Custom work, built in-house on the stack we run ourselves, at a Philippine cost base — not a template, and not agency margin.",
    say: [
      "“The $500 option is a template with your logo on it. You are buying something that books, quotes and answers.”",
      "“It is yours — domain, accounts, source. Nobody holds you hostage for edits.”",
      "“Enterprise is a quote because multi-location and e-commerce scope genuinely varies. We will not pretend otherwise.”",
    ],
    avoid: [
      "Do not quote pages. Quote outcomes — bookings taken, quotes sent, questions answered.",
      "Do not bundle the care plan into the build price. It is a separate decision and should be sold as one.",
    ],
    objection: {
      q: "“Squarespace would cost me $20 a month.”",
      a: "“It would, and if a brochure is all you need, take it. The moment the site has to take a booking, price a job or feed your CRM, you are paying someone to fight the template every month.”",
    },
  },
  {
    service: "App Development",
    price: "From $6,500",
    anchor: "Off-the-shelf software they have already outgrown, or a local dev shop at $25,000+.",
    frame: "A floor, not a price: we name where it starts so they can plan, and quote the rest once we have seen the operation.",
    say: [
      "“Six and a half is where a focused app starts. What it actually costs depends on what it has to talk to.”",
      "“We will not quote this on a call. You would not trust the number and we would not stand behind it.”",
      "“You own it — source, data, accounts. It is an asset on your side, not a subscription on ours.”",
    ],
    avoid: [
      "Never say “around ten thousand” to fill a silence. Give the floor and the discovery step.",
      "Do not compete with no-code quotes. Different product, different conversation.",
    ],
    objection: {
      q: "“Can you give me a ballpark?”",
      a: "“The floor is $6,500 and most focused builds land between there and $20,000. I can be precise after we map it in week one — and you keep that map whether or not we build it.”",
    },
  },
  {
    service: "AI Automation",
    price: "From $1,800 setup + $350/mo",
    anchor: "The hours it gives back: 30–60 hours of admin a month, which is $900–2,400 of someone's time.",
    frame: "Priced against what it returns, not against what it costs us to build — a typical first setup pays for itself inside two months.",
    say: [
      "“A first setup usually replaces 30 to 60 hours of admin a month. At any wage that is the setup fee back within two months.”",
      "“The $350 is not hosting. It is monitoring and tuning — automations rot if nobody watches them.”",
      "“A person still approves anything that matters. We are not selling you an unsupervised robot.”",
    ],
    avoid: [
      "Do not lead with AI. Lead with the hours. AI is how, not why.",
      "Do not promise headcount reduction. Promise capacity — it is true, and it does not make the room hostile.",
    ],
    objection: {
      q: "“Can't ChatGPT do this for free?”",
      a: "“It can draft. It cannot watch your tablets at 7 PM, know your procedures, file a claim inside the window or hand the exception to a person. What you are buying is the plumbing and the supervision around the model.”",
    },
  },
  {
    service: "CRM & Automations",
    price: "$1,200 – $2,600 one-time",
    anchor: "US consultancies at $2,500–6,000 for the same configuration.",
    frame: "Half of what a consultancy charges, and the team that configures it is the team that then uses it every day.",
    say: [
      "“Most CRM projects fail because the people who set it up never have to live in it. Ours do.”",
      "“Tool subscriptions are billed to you directly. We do not mark up other people's software.”",
      "“The migration is included. That is usually where these projects die.”",
    ],
    avoid: [
      "Do not promise a specific CRM before discovery. The right one depends on what they already run.",
      "Do not absorb their tool costs to close the deal — it hides the real run cost and poisons the renewal.",
    ],
    objection: {
      q: "“We already pay for HubSpot and nobody uses it.”",
      a: "“That is the normal outcome, and it is exactly what we fix. The problem is never the tool, it is that nobody wrote down who updates what, when. That is the deliverable here.”",
    },
  },
  {
    service: "SEO & Marketing",
    price: "$790 – $1,490/mo",
    anchor: "US local-SEO retainers at $1,000–2,500/mo, and the cost of not appearing at all.",
    frame: "A retainer priced below the US market, where the deliverable is a report an owner can read in five minutes.",
    say: [
      "“Results start showing in 60 to 90 days. Anyone promising faster is selling you something else.”",
      "“Reviews are half of this. Every review answered the same day, because that is what moves the ranking.”",
      "“Ad spend is yours and billed directly. We do not take a cut of your media.”",
    ],
    avoid: [
      "Never promise a ranking position. Promise the work and the reporting.",
      "Do not sell this to a business with no website worth sending traffic to. Sell the site first.",
    ],
    objection: {
      q: "“We tried SEO and it did nothing.”",
      a: "“Usually because it was content with no technical fixes and no review management. Ask them for the audit they did in month one — if there wasn't one, that is why.”",
    },
  },
  {
    service: "Branding & Design",
    price: "$1,900 – $2,400",
    anchor: "US studios starting at $5,000; marketplace logos at $300 with no strategy.",
    frame: "Studio process at a Philippine cost base — and the page they are reading is the proof.",
    say: [
      "“The best demonstration of this service is the proposal you are looking at.”",
      "“Two directions, one refined. Not fifty concepts — that is a marketplace, not a studio.”",
      "“You leave with the Figma file and the usage guide. It is yours.”",
    ],
    avoid: [
      "Do not sell brand identity to a business whose operations are on fire. Fix the operation first; the brand will not save them.",
      "Do not offer unlimited revisions. Two directions and one refinement is the process, and it is why it works.",
    ],
    objection: {
      q: "“$300 on Fiverr gets me a logo.”",
      a: "“It gets you a picture. What you are buying is the decision behind it — where it is used, how it holds up small, and a guide so it stays consistent when someone else builds your next page.”",
    },
  },
  {
    service: "Custom Software",
    price: "Custom quote",
    anchor: "Whatever they are currently paying in people-hours to work around software that does not exist.",
    frame: "No fixed price is honest here. The discovery is free, the estimate is real, and they keep the map either way.",
    say: [
      "“I am not going to give you a number I would have to walk back. Bring the operation to the call and you will leave with an estimate.”",
      "“You keep the scope document whether or not we build it. If you take it to another shop, that is a fair outcome.”",
      "“Milestone builds. You see working software every few weeks, not at the end.”",
    ],
    avoid: [
      "Never quote custom software on a first call, however hard they push.",
      "Do not say “it depends” and stop. Say what it depends on: scope, integrations, complexity, timeline.",
    ],
    objection: {
      q: "“Just give me a rough range.”",
      a: "“The honest answer is that the range is wide enough to be useless — and a number now would either scare you off or become a promise I cannot keep. One session and I can give you a real one.”",
    },
  },
];

/** The three sentences that decide most deals, kept where the team can find them. */
export const CLOSING_LINES: PlaybookRule[] = [
  {
    name: "When they say it is expensive",
    body: "“Compared to what?” — then wait. Almost every time, the comparison they name is one we beat on coverage, continuity or ownership. Price the gap, not the product.",
  },
  {
    name: "When they want to start smaller",
    body: "“Let's do that properly.” Narrow the scope to one operation, keep the rate, and set the date we review expanding it. A small engagement that works beats a big one that disappoints.",
  },
  {
    name: "When they go quiet after the number",
    body: "Do not fill the silence with a discount. Ask what part of the scope they are unsure about. Silence after a price is usually arithmetic, not rejection.",
  },
];

/**
 * Sales skills — the training half of the pricing handbook. INTERNAL ONLY.
 *
 * The positioning file (playbook.ts) says what to charge and how to frame
 * each number. This file teaches the craft around it: how a pricing
 * conversation actually runs, what to ask before you quote, who to say no
 * to, how to answer an objection without discounting, and how to practice.
 *
 * Written for operators who are good at the work and new to selling it. Every
 * line is something a person can say out loud on a call — no theory, no
 * acronyms nobody remembers under pressure.
 */

export interface Stage {
  n: string;
  name: string;
  goal: string;
  minutes: string;
  does: string[];
  sounds: string;
  mistake: string;
}

/** The arc of a 45-minute strategy call, start to finish. */
export const CALL_ARC: Stage[] = [
  {
    n: "01",
    name: "Frame the call",
    goal: "They know what is about to happen and that they are not being sold to yet.",
    minutes: "2 min",
    does: [
      "Say how long it will take and what they leave with.",
      "Say explicitly that you will not quote today unless the scope is obvious.",
      "Ask permission to take notes and to ask blunt questions.",
    ],
    sounds: "“Forty-five minutes. I want to understand how the operation runs today, where it leaks, and whether we are even the right fit. You will leave with a plan either way — yours to keep. Can I ask some blunt questions?”",
    mistake: "Opening with a pitch about HostOS. Nobody has asked yet, and you have learned nothing.",
  },
  {
    n: "02",
    name: "Map the operation",
    goal: "You can describe their day back to them better than they described it.",
    minutes: "15 min",
    does: [
      "Walk one real day, hour by hour, in their words.",
      "Ask who touches what, and what happens when that person is off.",
      "Find the moment they said “usually” or “normally” — that is where the process is missing.",
    ],
    sounds: "“Take me through yesterday. Who opened the inbox, what was in it, and what happened to the messages that came in after six?”",
    mistake: "Asking what they need. They will tell you what they think they can afford, not what is broken.",
  },
  {
    n: "03",
    name: "Quantify the gap",
    goal: "A number they said out loud, not one you supplied.",
    minutes: "8 min",
    does: [
      "Convert the pain into hours or dollars using their own figures.",
      "Ask them to confirm the arithmetic. Make them say the number.",
      "Write it down and repeat it back later, in the pricing moment.",
    ],
    sounds: "“So roughly six messages a night, and maybe one in three would have booked. What is a booking worth to you? … So that is about $X a month sitting unanswered. Does that sound right to you?”",
    mistake: "Estimating the cost for them. Your number is a guess; theirs is a commitment.",
  },
  {
    n: "04",
    name: "Show the shape of the answer",
    goal: "They can picture the operation running without them.",
    minutes: "10 min",
    does: [
      "Describe people, procedure, automation and dashboard as one system.",
      "Use one of their processes as the worked example, not a generic one.",
      "Say what stays theirs: the data, the documentation, the accounts.",
    ],
    sounds: "“Here is what your Tuesday looks like in week five: the tablets are watched, the claims are filed, and you read one board at eight and decide two things.”",
    mistake: "Feature tours. They do not want software, they want their evenings back.",
  },
  {
    n: "05",
    name: "Price it",
    goal: "The number lands against a comparison, not against zero.",
    minutes: "5 min",
    does: [
      "Name the alternative first — the hire, the freelancer, or doing nothing.",
      "Repeat the number they gave you in stage three.",
      "Then say the price, once, and stop talking.",
    ],
    sounds: "“A hire for this coverage is about $4,000 a month here, and they still cannot cover a weekend. You told me the gap costs you around $X. This is $2,890 a month.”",
    mistake: "Talking past the number. Say it and let the silence do its work.",
  },
  {
    n: "06",
    name: "Agree the next step",
    goal: "A date, in their calendar, with a named thing that happens.",
    minutes: "5 min",
    does: [
      "Offer one next step, not three.",
      "Set the date on the call, not by email afterwards.",
      "Send the plan the same day whether or not they said yes.",
    ],
    sounds: "“I will send the map by Thursday. Shall we put thirty minutes in for Monday to go through it?”",
    mistake: "“I will follow up next week.” That is a way of saying nobody owns the next step.",
  },
];

export interface Question {
  ask: string;
  why: string;
}

/** Discovery questions that make the pricing conversation easy later. */
export const DISCOVERY: { group: string; questions: Question[] }[] = [
  {
    group: "Where the money leaks",
    questions: [
      { ask: "What came in overnight, and when did someone answer it?", why: "Response time is the easiest gap to price and the first one we close." },
      { ask: "When did you last lose a customer, and what actually happened?", why: "Gives you a real story to reference in the pricing moment." },
      { ask: "What did you have to redo last month because something was missed?", why: "Rework is pure cost and they have never counted it." },
    ],
  },
  {
    group: "Where the work lives",
    questions: [
      { ask: "If your best person left on Friday, what breaks on Monday?", why: "Finds the undocumented process — our core deliverable." },
      { ask: "Which of these tools disagree with each other?", why: "Opens the integration conversation without pitching it." },
      { ask: "What do you personally still do that you know you should not?", why: "The owner's own hours are the strongest ROI argument we have." },
    ],
  },
  {
    group: "Whether they can buy",
    questions: [
      { ask: "Who else needs to agree to this?", why: "Find the second decision-maker in week one, not week six." },
      { ask: "What have you already tried, and why did it not stick?", why: "Tells you what to avoid sounding like." },
      { ask: "If this works, what does it let you do that you cannot do now?", why: "Their answer becomes the reason they sign." },
    ],
  },
];

export interface Objection {
  says: string;
  means: string;
  answer: string;
  never: string;
}

/** The objection library — not just price. */
export const OBJECTIONS: Objection[] = [
  {
    says: "“It is too expensive.”",
    means: "They have not connected the number to a cost they already pay.",
    answer: "“Compared to what?” Then wait. Whatever they name — a hire, a freelancer, doing nothing — price against that and bring back the number they gave you in discovery.",
    never: "Never discount in the same breath. It tells them the first number was invented.",
  },
  {
    says: "“We need to think about it.”",
    means: "There is a specific unanswered question they have not said out loud.",
    answer: "“Of course. What is the part you are least sure about — the scope, the money, or whether it will actually stick?” Naming the three makes it easy to pick one.",
    never: "Never say “sure, I'll check in next week.” That is a way of not asking.",
  },
  {
    says: "“Send me a proposal.”",
    means: "Either genuine interest, or a polite exit.",
    answer: "“I will. So it is useful rather than generic — which of the three things we discussed should it lead with?” If they cannot answer, it was an exit, and that is worth knowing now.",
    never: "Never send a proposal you have not been asked a shaping question about.",
  },
  {
    says: "“We already have VAs.”",
    means: "They are half-solved and frustrated, or genuinely fine.",
    answer: "“Good — then you have the hardest part. Do they have written procedures, cover when they are off, and a board you can read? If not, we usually keep the people and fix the system around them.”",
    never: "Never criticise their current team. You are asking them to admit a hiring mistake, and they will not.",
  },
  {
    says: "“How do I know you will not disappear?”",
    means: "They have been burned by an agency before.",
    answer: "“Everything we build is in your name from week one — domain, data, documentation, source. If we part ways you keep all of it. That is deliberate, and it is in writing.”",
    never: "Never answer with reassurance alone. Answer with the mechanism.",
  },
  {
    says: "“Can you do a trial month?”",
    means: "They want to reduce risk, which is reasonable.",
    answer: "“The first thirty days are the trial — week one you get the map whether or not we continue. What I will not do is a half-staffed month, because that guarantees the result you are afraid of.”",
    never: "Never agree to a discounted trial. Under-resourced pilots fail and become the reason they say no.",
  },
  {
    says: "“Your competitor quoted half.”",
    means: "They are comparing two different scopes as if they were the same.",
    answer: "“They may well be the right choice. Can I ask what is in theirs? If it is hours, ours is not comparable — you would be buying a person from them and an operation from us.”",
    never: "Never match a price to win. We lose the client anyway, six months later, at our own cost.",
  },
  {
    says: "“Not right now — call me in six months.”",
    means: "No urgency, because the cost of waiting was never made concrete.",
    answer: "“That is fair. Before I go — the gap we counted was about $X a month. Over six months that is $Y. If that number is wrong, I would genuinely like to know where.”",
    never: "Never accept the delay without restating the arithmetic once, calmly.",
  },
];

export interface Drill {
  name: string;
  setup: string;
  run: string;
  looksLike: string;
}

/** Practice. Skills do not come from reading a document. */
export const DRILLS: Drill[] = [
  {
    name: "The silence drill",
    setup: "Pairs. One is the operator, one is the owner.",
    run: "Say the price out loud, then say nothing until the other person speaks. Count the seconds. Repeat five times until the silence stops feeling like a problem.",
    looksLike: "Good: the price, then stillness. Bad: the price, then “…but we can look at that if the budget is tight.”",
  },
  {
    name: "Compared to what",
    setup: "One person plays an owner who says only “that is too expensive.”",
    run: "The operator must respond with a question, never a justification, and keep asking until the real comparison is named. Three rounds each.",
    looksLike: "Good: “Compared to what?” Bad: “Well, it includes a lot…”",
  },
  {
    name: "The arithmetic drill",
    setup: "Take a real client's numbers from the last discovery call.",
    run: "Out loud, in under sixty seconds, turn their operational pain into a monthly dollar figure using only numbers they gave you.",
    looksLike: "Good: “Six missed messages a night, one in three books, $180 a booking — that's about $1,000 a month.” Bad: any number you invented.",
  },
  {
    name: "The scope-down drill",
    setup: "An owner who wants the Professional outcome on the Starter budget.",
    run: "Reduce the scope without reducing the rate, and say it in one sentence that does not sound like a punishment.",
    looksLike: "Good: “Let's take one operation and do it properly — the fleet inbox, nothing else, same rate.” Bad: “I could maybe do $2,200.”",
  },
];

/** The one page to keep on the desk. */
export const CHEAT_SHEET: { heading: string; lines: string[] }[] = [
  {
    heading: "Before you quote",
    lines: [
      "Have they said a number out loud? If not, you are not ready to price.",
      "Do you know what they are comparing us to?",
      "Do you know who else has to agree?",
    ],
  },
  {
    heading: "Saying the price",
    lines: [
      "Alternative first. Their number second. Our price third.",
      "Say it once. Then stop.",
      "Never explain a price that has not been questioned.",
    ],
  },
  {
    heading: "When it gets hard",
    lines: [
      "“Compared to what?”",
      "“What part are you least sure about?”",
      "Scope down, never rate down.",
    ],
  },
  {
    heading: "Before you hang up",
    lines: [
      "One next step, with a date, agreed on the call.",
      "Send the plan the same day, yes or no.",
      "Write down the number they gave you. You will need it next time.",
    ],
  },
];

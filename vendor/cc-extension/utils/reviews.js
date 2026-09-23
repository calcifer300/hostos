window.HostOS = window.HostOS || {};

// Post-trip reviews: what is waiting on Matt, and why.
//
// One module for the whole decision so the panel, the popup, the nightly
// report and the notifications cannot disagree about whether a trip still
// needs him. Loaded by the content scripts, the popup and the service worker
// alike, so it depends on HostOS.dates and HostOS.constants only.
//
// Two facts about Turo shape everything here (both read live, 2026-09-10):
//
//   - This account is a CO_HOST and Turo web shows it no rate-guest control
//     anywhere. Matt rates from the app. So nothing here submits a rating; it
//     organises the decision and notices when the rating has been given.
//   - A host's review of a guest is public on the guest's profile
//     (/api/driver/reviews_from_owners), with the author and date. That is how
//     "has Matt rated this trip yet" is known without any Turo flag: a review
//     by someone on the host team, dated after the trip ended.
//
// Turo sends the guest the discount code itself once a 5-star rating is
// given (John, 2026-09-10), so the rating is the whole workflow: a rated trip
// is done.
//
// Matt's rule (John, 2026-09-11): he rates a guest back only once the guest
// has rated HIM 5 stars. Turo publishes reviews double-blind - a guest's
// review of the host only becomes visible once the host reviews back (read
// live: Kaushal's review of Matt is dated the day Matt rated him; no other
// recent guest's appears at all) - so the API cannot say who has rated him.
// The guest's own message can: Matt's closing note asks them to say so, and
// the trip's thread is readable as JSON. "Ready" means the guest has said it.
HostOS.reviews = (() => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Words in another host's review of this guest that Matt would want to see
  // before rating. Matched on the review TEXT and shown with the quote, never
  // as a score. The label is what the badge says.
  //
  // Only reviews rated 4 stars or below are searched. A 5-star review is
  // praise whatever words it uses: "Alexander was more than understanding
  // when a prior guest failed to return the car on time and messed up his
  // plans" - 5 stars, 2026-06-29 - was flagged DIRTY on the word "messed",
  // and the card told Matt to inspect before rating a model guest. Words are
  // ambiguous; a host's star rating is not.
  const FLAG_RATING_MAX = 4;
  // A negated mention is the opposite of a complaint: "no smoke smell at all".
  const NEGATED = /\b(no|not|never|without|zero|didn't|did not|wasn't|was not|free of)\s+(?:\w+\s+){0,2}$/i;
  const KEYWORDS = [
    { label: "Smoking", pattern: /\b(smok\w*|cigar\w*|vap\w*|weed|marijuana)\b/i },
    { label: "Dirty", pattern: /\b(dirty|filthy|trash|garbage|messy|stain\w*|sand everywhere|dog hair|pet hair)\b/i },
    { label: "Damage", pattern: /\b(damage\w*|scratch\w*|dent\w*|crack\w*|broke\w*|windshield)\b/i },
    { label: "Late", pattern: /\b(late|overdue|past the return|didn't return on time|did not return on time)\b/i },
    { label: "Communication", pattern: /\b(unresponsive|no response|rude|disrespect\w*|hostile|argumentative)\b/i },
    { label: "Fuel / charge", pattern: /\b(empty tank|tank was empty|on empty|out of gas|low fuel|not charged|wasn't charged|low battery|didn't charge|did not charge|no gas)\b/i },
    { label: "Incident", pattern: /\b(police|accident|tow\w*|ticket\w*|speeding|citation|impound\w*)\b/i },
    { label: "Unauthorised driver", pattern: /\b(unauthori[sz]ed driver|someone else (was )?driving|another driver)\b/i }
  ];

  // Things that can go wrong on a trip, as the host would mark them. Marked
  // by exception on purpose: an untouched list means the car came back fine,
  // so the common case is zero taps. The spec listed these as positive
  // checkboxes; fourteen ticks per trip is not a thirty-second workflow.
  const PROBLEMS = [
    { id: "damage", label: "Damage" },
    { id: "dirty", label: "Dirty interior" },
    { id: "smoke", label: "Smoke odor" },
    { id: "fuel", label: "Fuel / charge short" },
    { id: "items", label: "Keys / items missing" },
    { id: "late-pickup", label: "Late pickup" },
    { id: "late-return", label: "Late return" },
    { id: "communication", label: "Poor communication" },
    { id: "instructions", label: "Ignored instructions" },
    { id: "policy", label: "Policy violation" },
    { id: "dispute", label: "Dispute" },
    { id: "roadside", label: "Roadside incident" }
  ];

  // What a guest writes when they have rated the host. Matched on the
  // guest's own messages after the trip; the sentence is kept as the quote.
  const SAYS_RATED = /\b(?:(?:5|five)[- ]?stars?|left (?:you )?(?:a |the |my )?review|rated you|reviewed you|gave you (?:5|five)|just (?:left|wrote|did) (?:a |the |my )?review|review(?:'s| is) (?:done|in|up))\b/i;
  function saysRated(text) {
    const body = String(text || "");
    if (!SAYS_RATED.test(body)) return null;
    const sentence = body.split(/(?<=[.!?])\s+|\n+/).find((candidate) => SAYS_RATED.test(candidate)) || body;
    return sentence.trim().slice(0, 140);
  }

  // Whether Matt's rule lets him rate this trip yet.
  function readiness(trip) {
    const said = trip && trip.guestSaysRated;
    if (said && said.quote) return { ready: true, quote: said.quote, at: said.at || null };
    return { ready: false, quote: null, at: null };
  }

  function endedAt(trip) {
    // The API's tripEnd is the real end; the list scan's returnDate is the
    // scheduled one. Either will do for the window, the real one is better.
    return HostOS.dates.parseTime(trip.completedAt) || HostOS.dates.parseTime(trip.returnDate);
  }

  // Whole days left in Turo's review window, from the day the trip ended.
  // The window is Turo policy (10 days, per Turo's help centre), not
  // something the API reports - so the card says "Turo's 10-day window" and
  // never dresses it up as a figure read from the trip. Null when the end is
  // unknown; negative once the window has closed.
  function daysLeft(trip, now = Date.now()) {
    const ended = endedAt(trip);
    if (ended === null) return null;
    const elapsed = (now - ended) / DAY_MS;
    return Math.ceil(HostOS.constants.REVIEW_WINDOW_DAYS - elapsed);
  }

  // The rating Matt gave, from whichever source knows it: his own tap on the
  // card, or the review Turo shows on the guest's profile.
  function ratingGiven(trip, record) {
    const own = record && Number.isInteger(record.rating) ? record.rating : null;
    if (own !== null) return own;
    return Number.isInteger(trip.hostReviewRating) ? trip.hostReviewRating : null;
  }

  // pending    - completed, inside the window, no rating known
  // done       - rated (on the card, or seen in Turo), or dismissed
  // expired    - never rated and the window has closed
  // none       - not a completed trip
  function state(trip, record, now = Date.now()) {
    if (!trip || trip.completed !== true || HostOS.dates.isCancelled(trip)) return "none";
    if (record && record.dismissedAt) return "done";
    const rating = ratingGiven(trip, record);
    if (rating === null) {
      const left = daysLeft(trip, now);
      return left !== null && left < 0 ? "expired" : "pending";
    }
    return "done";
  }

  // Everything on the list: trips the guest has already rated first, then
  // the rest, each soonest-to-expire first.
  function pending(trips, records = {}, now = Date.now()) {
    return (trips || [])
      .map((trip) => ({ trip, record: records[trip.reservationId] || null }))
      .map((entry) => ({ ...entry, state: state(entry.trip, entry.record, now), ready: readiness(entry.trip).ready }))
      .filter((entry) => entry.state === "pending")
      .sort((a, b) => {
        if (a.ready !== b.ready) return a.ready ? -1 : 1;
        return (daysLeft(a.trip, now) ?? 99) - (daysLeft(b.trip, now) ?? 99);
      });
  }

  // What Turo's data says about the trip and the guest, as badges. Every
  // entry names a figure or quotes a line - nothing here is a judgement.
  function signals(trip) {
    const out = [];
    const excess = HostOS.parser.number(trip.milesExcess);
    if (excess !== null && excess > 0) out.push({ label: "Extra mileage", detail: "+" + Math.round(excess).toLocaleString() + " mi over the allowance" });
    if (trip.reimbursementOpen === true) out.push({ label: "Reimbursement open", detail: trip.reimbursementNote || "an incidental invoice is outstanding" });
    const rating = HostOS.parser.number(trip.guestRating);
    const count = HostOS.parser.number(trip.guestRatingCount) || 0;
    if (rating !== null && count > 0 && rating < 4.5) out.push({ label: "Low rating", detail: rating.toFixed(1) + "★ from " + count + " host" + (count === 1 ? "" : "s") });
    (trip.guestReviewFlags || []).forEach((flag) => out.push({
      label: "Prior review: " + flag.label,
      // The reviewer's star count sits next to their words, so the weight
      // of the complaint is visible: a 2-star "smelled of smoke" and a 4-star
      // "slight smoke smell, otherwise great" read differently.
      detail: "\u201c" + flag.quote + "\u201d"
        + (flag.rating ? " \u2014 " + flag.rating + "\u2605" : "") + (flag.date ? " \u00b7 " + flag.date : "")
    }));
    return out;
  }

  // Keyword flags from other hosts' reviews of this guest. Quote is the
  // sentence the word appeared in, trimmed, so Matt reads the host's own
  // words rather than a label.
  function flagsFromReviews(reviews) {
    const flags = [];
    (reviews || []).forEach((review) => {
      const text = String(review.review || "");
      const rating = Number.isInteger(review.overallRating) ? review.overallRating : null;
      // No rating, no flag: without the star count a word cannot be told
      // apart from praise. Turo always supplies one.
      if (!text || rating === null || rating > FLAG_RATING_MAX) return;
      KEYWORDS.forEach((keyword) => {
        if (flags.some((flag) => flag.label === keyword.label)) return;
        const sentences = text.split(/(?<=[.!?])\s+/);
        const sentence = sentences.find((candidate) => {
          const match = candidate.match(keyword.pattern);
          return match && !NEGATED.test(candidate.slice(0, match.index));
        });
        if (!sentence) return;
        flags.push({
          label: keyword.label,
          quote: sentence.trim().slice(0, 140),
          rating: Number.isInteger(review.overallRating) ? review.overallRating : null,
          date: review.date && review.date.localDate ? review.date.localDate : null
        });
      });
    });
    return flags.slice(0, 5);
  }

  // The recommendation, as reasons. "Inspect first" whenever Turo's data or
  // the host's own marks say anything at all; otherwise the honest version of
  // "safe to rate 5" - which is that nothing Turo knows argues against it.
  function recommendation(trip, record) {
    const reasons = signals(trip).map((signal) => signal.label.toLowerCase());
    const marked = ((record && record.problems) || []).map((id) => {
      const problem = PROBLEMS.find((candidate) => candidate.id === id);
      return problem ? problem.label.toLowerCase() : id;
    });
    if (reasons.length || marked.length) {
      // Turo's data and Matt's own marks are named separately, so "damage"
      // read from a prior host's review and "damage" he marked himself do
      // not collapse into one word repeated.
      const parts = [reasons.length ? reasons.join(", ") : null,
        marked.length ? "you marked: " + marked.join(", ") : null].filter(Boolean);
      return { verdict: "inspect", text: "Inspect before rating — " + parts.join(" · ") };
    }
    return { verdict: "clean", text: "Nothing in Turo's data argues against 5 stars — rate 5 if the car came back fine" };
  }

  return { KEYWORDS, PROBLEMS, daysLeft, endedAt, ratingGiven, state, pending, signals, flagsFromReviews, recommendation, saysRated, readiness };
})();

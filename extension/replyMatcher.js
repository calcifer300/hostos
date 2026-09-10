// Shared pattern-matching for Saved Replies.
// Scores an incoming message against each saved reply's trigger phrase by
// keyword overlap, so a recurring question ("where's the key?", "key
// location?", "lockbox code?") can be recognized without an exact match.
(function (root) {
  const STOPWORDS = new Set([
    'the', 'and', 'for', 'are', 'you', 'your', 'that', 'this', 'with', 'was',
    'have', 'has', 'can', 'will', 'just', 'not', 'but', 'what', 'when', 'where',
    'how', 'why', 'who', 'from', 'about', 'there', 'here', 'thanks', 'thank',
    'please', 'hey', 'hello', 'hii', 'got', 'get', 'did', 'does', 'been'
  ]);

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(str) {
    return normalize(str)
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  // Fraction of the trigger's keywords that are present in the message.
  function scoreAgainstTrigger(messageTokens, triggerTokens) {
    if (!triggerTokens.length) return 0;
    const messageSet = new Set(messageTokens);
    let hits = 0;
    for (const t of triggerTokens) {
      if (messageSet.has(t)) hits++;
    }
    return hits / triggerTokens.length;
  }

  const MATCH_THRESHOLD = 0.6;

  function matchSavedReply(message, savedReplies) {
    const messageTokens = tokenize(message);
    if (!messageTokens.length || !Array.isArray(savedReplies) || !savedReplies.length) {
      return null;
    }

    let best = null;
    for (const item of savedReplies) {
      const triggerTokens = tokenize(item.trigger);
      const score = scoreAgainstTrigger(messageTokens, triggerTokens);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { ...item, score };
      }
    }
    return best;
  }

  root.matchSavedReply = matchSavedReply;
})(typeof window !== 'undefined' ? window : this);

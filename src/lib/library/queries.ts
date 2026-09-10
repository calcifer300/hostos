import "server-only";
import { cache } from "react";
import { runQueryOr } from "@/lib/supabase/server";

/**
 * Search over Turo's help centre, imported from Karl's Turo-Context-Library.
 *
 * NOT fleet-scoped, deliberately: this is Turo's own published policy, the
 * same for every operator on the platform.
 *
 * The point of having it in HostOS rather than in a separate tool is
 * `findRelevantPolicy` at the bottom — a drafted reply can now be checked
 * against what Turo actually says, instead of only against the host's own
 * house rules.
 */

export interface TuroArticle {
  id: string;
  title: string;
  url: string;
  category: string | null;
  excerpt: string | null;
  content: string;
}

interface ArticleRow {
  id: string;
  title: string;
  url: string;
  category: string | null;
  excerpt: string | null;
  content: string;
}

const LIST_COLUMNS = "id, title, url, category, excerpt";

function rowToArticle(row: Partial<ArticleRow>): TuroArticle {
  return {
    id: row.id ?? "",
    title: row.title ?? "Untitled",
    url: row.url ?? "",
    category: row.category ?? null,
    excerpt: row.excerpt ?? null,
    content: row.content ?? "",
  };
}

/**
 * Turns what someone typed into a websearch tsquery.
 *
 * `websearch_to_tsquery` is the right parser here rather than `plainto_` or
 * raw `to_tsquery`: it accepts quoted phrases and "or", ignores punctuation
 * that would otherwise be a syntax error, and — the part that matters — never
 * throws on user input. A search box that 500s on an apostrophe is worse than
 * one that returns nothing.
 */
function sanitizeQuery(raw: string): string {
  // Control characters only, not punctuation: websearch_to_tsquery copes
  // with quotes and apostrophes by design, but a NUL or control byte
  // carried in from a paste is a hard error rather than a bad match.
  return raw.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);
}

export interface ArticleSearchResult {
  articles: TuroArticle[];
  /** True when the table isn't there or is unreachable — an empty result that isn't "no matches". */
  degraded: boolean;
}

export const searchArticles = cache(async function searchArticles(
  query: string,
  category?: string | null,
  limit = 25
): Promise<ArticleSearchResult> {
  const q = sanitizeQuery(query);

  const { data, degraded } = await runQueryOr<ArticleRow[]>("turo_articles.search", [], (client) => {
    let builder = client.from("turo_articles").select(LIST_COLUMNS);

    if (q) {
      // Ranked by the generated tsvector, which weights title above excerpt
      // above body — see migration 0014.
      builder = builder.textSearch("search_vector", q, { type: "websearch", config: "english" });
    } else {
      builder = builder.order("title", { ascending: true });
    }

    if (category) builder = builder.eq("category", category);

    return builder.limit(limit).returns<ArticleRow[]>();
  });

  return { articles: data.map(rowToArticle), degraded };
});

export const getArticle = cache(async function getArticle(id: string): Promise<TuroArticle | null> {
  const { data } = await runQueryOr<ArticleRow | null>("turo_articles.get", null, (client) =>
    client
      .from("turo_articles")
      .select("id, title, url, category, excerpt, content")
      .eq("id", id)
      .maybeSingle<ArticleRow>()
  );

  return data ? rowToArticle(data) : null;
});

export interface CategoryCount {
  category: string;
  count: number;
}

/**
 * Categories with how many articles each holds.
 *
 * Counted in the app rather than with a grouped query because PostgREST has no
 * GROUP BY, and 725 category strings is a trivial read — the alternative is a
 * database view for something that changes only when Karl re-scrapes.
 */
export const getCategories = cache(async function getCategories(): Promise<CategoryCount[]> {
  const { data } = await runQueryOr<{ category: string | null }[]>(
    "turo_articles.categories",
    [],
    (client) => client.from("turo_articles").select("category").limit(2000).returns<{ category: string | null }[]>()
  );

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.category) continue;
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
});

/** How many articles are loaded at all — drives the "not imported yet" state. */
export const getArticleCount = cache(async function getArticleCount(): Promise<number> {
  const { data } = await runQueryOr<number>("turo_articles.count", 0, async (client) => {
    const res = await client.from("turo_articles").select("*", { count: "exact", head: true });
    return { data: res.count ?? 0, error: res.error, status: res.status };
  });

  return data;
});

/**
 * The Turo policy most relevant to a guest message, for grounding a reply.
 *
 * This is why the library is inside HostOS rather than beside it. Butler and
 * the AI briefing ground drafts in the host's own knowledge base, which says
 * how THEY do things — it cannot tell you that Turo's cancellation window is
 * what it is, so a confident, well-toned reply could contradict the platform's
 * own policy and the host would only find out from the guest.
 *
 * Returns at most `limit` articles, and returns nothing rather than something
 * weak: an irrelevant policy pasted into a prompt is worse than no policy,
 * because the model will try to use it.
 */
export async function findRelevantPolicy(
  message: string,
  limit = 3
): Promise<TuroArticle[]> {
  const q = sanitizeQuery(message);
  if (q.length < 8) return [];

  // A whole guest message is not a search query — it carries greetings, names
  // and small talk that match everything weakly. Keywords only, and only the
  // ones long enough to be about something.
  const keywords = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOPWORDS.has(w))
    .slice(0, 8);

  if (keywords.length === 0) return [];

  const { data } = await runQueryOr<ArticleRow[]>("turo_articles.relevant", [], (client) =>
    client
      .from("turo_articles")
      .select("id, title, url, category, excerpt, content")
      .textSearch("search_vector", keywords.join(" or "), { type: "websearch", config: "english" })
      .limit(limit)
      .returns<ArticleRow[]>()
  );

  return data.map(rowToArticle);
}

/**
 * Words that appear in every guest message and match every article.
 *
 * Longer than a generic stopword list because the domain has its own filler:
 * "vehicle", "rental" and "booking" are in most of the 725 articles and in
 * most guest messages, so matching on them ranks by nothing at all.
 */
const STOPWORDS = new Set([
  "about", "after", "again", "also", "another", "because", "before", "being",
  "between", "could", "does", "doing", "during", "every", "from",
  "have", "having", "hello", "here", "just", "know", "like", "make", "many",
  "message", "might", "more", "most", "much", "must", "need", "other", "over",
  "please", "really", "right", "should", "some", "such", "than", "thank",
  "thanks", "that", "their", "them", "then", "there", "these", "they", "thing",
  "think", "this", "those", "through", "time", "today", "under", "very",
  "want", "were", "what", "when", "where", "which", "while", "will", "with",
  "would", "your",
  // Domain filler — in almost every article and almost every message.
  "booking", "rental", "vehicle", "turo", "trip", "guest", "host", "car",
]);

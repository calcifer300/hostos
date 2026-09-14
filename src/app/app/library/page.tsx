import Link from "next/link";
import { BookMarked, ExternalLink } from "lucide-react";
import { getCategories, searchArticles, getArticleCount } from "@/lib/library/queries";

/**
 * Turo's help centre, searchable — imported from Karl's Turo-Context-Library.
 *
 * Separate from Knowledge, which holds the host's OWN house rules. The two
 * answer different questions: Knowledge is "how do WE do check-in", this is
 * "what does Turo actually allow". A reply needs both, and getting them
 * confused is how you tell a guest something Turo's own policy contradicts.
 */

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = params.category ?? null;

  const [{ articles, degraded }, categories, total] = await Promise.all([
    searchArticles(query, category),
    getCategories(),
    getArticleCount(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Policy library</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Turo&rsquo;s own help centre, searchable.{" "}
          {total > 0 ? `${total} articles.` : ""} For how <em>your</em> fleet does things, see{" "}
          <Link href="/app/knowledge" className="font-medium text-accent hover:underline">
            Knowledge
          </Link>
          .
        </p>
      </div>

      {total === 0 && !degraded ? (
        <NotImported />
      ) : (
        <>
          {/* A plain GET form: search belongs in the URL so a result can be
              shared and the back button does what it should. */}
          <form method="GET" className="flex flex-wrap gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cancellation window, mileage limit, damage claim…"
              aria-label="Search Turo policy"
              className="min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-accent/60"
            />
            <select
              name="category"
              defaultValue={category ?? ""}
              aria-label="Category"
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-[12.5px] outline-none transition-colors focus:border-accent/60"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-accent px-4 py-2 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Search
            </button>
          </form>

          {degraded && (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12.5px] text-warning">
              Couldn&rsquo;t reach the library just now — this isn&rsquo;t &ldquo;no results&rdquo;.
            </p>
          )}

          <div className="mt-5">
            {articles.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-8 text-center text-[13.5px] text-muted-foreground shadow-[var(--shadow-card)]">
                {query
                  ? `Nothing matching “${query}”.`
                  : "No articles in this category."}
              </p>
            ) : (
              <>
                <p className="mb-2 px-1 text-[12px] text-muted-foreground">
                  {articles.length} result{articles.length === 1 ? "" : "s"}
                  {query ? ` for “${query}”` : ""}
                </p>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                  {articles.map((article) => (
                    <li key={article.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-[14px] font-medium tracking-tight">{article.title}</h2>
                          {article.category && (
                            <p className="mt-0.5 text-[11.5px] uppercase tracking-wide text-muted-foreground">
                              {article.category}
                            </p>
                          )}
                        </div>
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                          >
                            On Turo
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        )}
                      </div>
                      {article.excerpt && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                          {article.excerpt}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Scraped from Turo&rsquo;s public help centre. Policies change — for anything
                  binding, follow the link and read the live page.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotImported() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <BookMarked className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-[14px] font-medium">The policy library is empty</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Turo&rsquo;s help centre hasn&rsquo;t been imported into this deployment yet. Run the
        importer once and it fills in:
      </p>
      <code className="mt-3 inline-block rounded-lg bg-muted px-3 py-1.5 font-mono text-[12px]">
        node scripts/import-turo-articles.mjs
      </code>
    </div>
  );
}

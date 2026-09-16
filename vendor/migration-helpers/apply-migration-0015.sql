-- HostOS — migration 0015: rank article search results
-- Paste into the Supabase SQL Editor and Run. Creates one function.
-- Safe to run twice (create or replace).

-- Rank article search results.
--
-- 0014 gave turo_articles a weighted tsvector and a GIN index, which makes
-- matching fast and says nothing about ordering. PostgREST's text-search
-- operators FILTER; they cannot ORDER BY relevance, because the rank depends
-- on the query and so cannot be a stored column.
--
-- The result was a search that looked like it worked and did not: rows came
-- back in physical table order, so "damage claim" returned an airport
-- directory page and "mileage limit" returned the extenuating-circumstances
-- policy. Both are genuine matches. Neither is the answer.
--
-- A function is the only way to get ORDER BY ts_rank through PostgREST.

create or replace function search_turo_articles(
  q text default '',
  cat text default null,
  lim int default 25
)
returns table (
  id text,
  title text,
  url text,
  category text,
  excerpt text,
  rank real
)
language sql
stable
-- INVOKER, not DEFINER. The table holds Turo's public help centre and nothing
-- fleet-scoped, so this needs no elevated rights — and a SECURITY DEFINER
-- function that doesn't need to be one is a standing invitation.
security invoker
set search_path = public
as $$
  with parsed as (
    -- websearch_to_tsquery rather than to_tsquery: it accepts quoted phrases
    -- and "or", ignores punctuation that would otherwise be a syntax error,
    -- and never throws on user input. A search box that errors on an
    -- apostrophe is worse than one that returns nothing.
    select case
             when q is null or btrim(q) = '' then null
             else websearch_to_tsquery('english', q)
           end as tsq
  )
  select
    a.id,
    a.title,
    a.url,
    a.category,
    a.excerpt,
    case
      when p.tsq is null then 0::real
      -- Normalisation 1 divides by 1 + log(document length).
      --
      -- Without it, long documents win everything: 377 of the 725 articles are
      -- airport directory pages running to tens of thousands of words, and a
      -- document that mentions a term twenty times in passing outranks the
      -- article actually titled for it. The weights from 0014 (title A,
      -- excerpt B, body C) then do what they were meant to.
      else ts_rank(a.search_vector, p.tsq, 1)
    end as rank
  from turo_articles a
  cross join parsed p
  where (p.tsq is null or a.search_vector @@ p.tsq)
    and (cat is null or a.category = cat)
  order by
    rank desc,
    -- Ties, and the no-query case, fall back to something stable rather than
    -- to whatever order the heap happens to hold.
    a.title asc
  limit least(greatest(coalesce(lim, 25), 1), 100);
$$;

-- PostgREST exposes functions to whichever role calls it. The app connects as
-- service_role; anon and authenticated are granted too so this keeps working
-- if the app ever reads the library with a publishable key — the table holds
-- public policy, and RLS still governs the rows themselves.
grant execute on function search_turo_articles(text, text, int) to service_role, anon, authenticated;

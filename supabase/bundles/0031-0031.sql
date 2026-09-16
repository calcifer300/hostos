-- HostOS — migrations 0031 to 0031, bundled 2026-09-16
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0031_team_full_names.sql
-- ======================================================================
-- HostOS — migration 0031: full names on the team roster, and the hierarchy order.
--
-- Tiles now show each member's full name; the nickname (what the page used
-- to call them) appears when a tile is opened. The built-in roster is
-- renamed here by slug, only where the name is still the nickname, so a
-- member the Founder has already renamed is left alone. Re-running is a no-op.

alter table team_profiles add column if not exists nickname text;

update team_profiles set nickname = name where nickname is null or nickname = '';

update team_profiles as t
set name = v.full_name, position = v.pos
from (values
  ('john',     'John Briones',             0),
  ('karl',     'Karl Rodriguez',           1),
  ('gerald',   'Gerald Ramirez',           2),
  ('belle',    'Maribel Magbual',          3),
  ('devie',    'John Devie Ulanday',       4),
  ('red',      'Givhine Leosala',          5),
  ('loisa',    'Loisa Celetaria',          6),
  ('princess', 'Princess Vergara',         7),
  ('karu',     'John Reigner Karunaratne', 8),
  ('david',    'David Briones',            9),
  ('ayie',     'Mariel Briones',          10),
  ('jb',       'Jasper Briones',          11)
) as v(slug, full_name, pos)
where t.slug = v.slug and t.name = t.nickname;

-- "Founder & CEO" reads better on a tile than the long form; Karl keeps his one full title.
update team_profiles set title = 'Founder & CEO' where slug = 'john' and title = 'Founder & Chief Executive Officer';

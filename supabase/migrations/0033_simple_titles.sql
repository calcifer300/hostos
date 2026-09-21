-- 0033: simple, humble role titles (no director, no chief)
update public.team_profiles set title = v.title from (values
  ('john', 'Founder'),
  ('karl', 'Technology'),
  ('gerald', 'Operations'),
  ('belle', 'Finance'),
  ('devie', 'Marketing & growth'),
  ('red', 'Sales & partnerships'),
  ('loisa', 'Content & communications'),
  ('princess', 'Scheduling & support'),
  ('karu', 'Strategy & process'),
  ('david', 'Research & data'),
  ('ayie', 'Client support'),
  ('jb', 'Projects & people')
) as v(slug, title) where team_profiles.slug = v.slug;

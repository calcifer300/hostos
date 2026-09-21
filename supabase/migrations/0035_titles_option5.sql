-- 0035: role titles that describe each person's focus
update public.team_profiles set title = v.title from (values
  ('john', 'Founder'), ('karl', 'Platform Development'), ('gerald', 'Fleet Operations'), ('belle', 'Finance & Admin'),
  ('devie', 'Growth'), ('red', 'Partnerships'), ('loisa', 'Brand & Content'), ('princess', 'Customer Experience'),
  ('karu', 'Product Strategy'), ('david', 'Research & Analytics'), ('ayie', 'Client Experience'), ('jb', 'Project Operations')
) as v(slug, title) where team_profiles.slug = v.slug;

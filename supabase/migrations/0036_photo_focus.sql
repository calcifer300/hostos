-- 0036: where each portrait is centred ("x% y%"), so no face or hair is cut by the frame
alter table public.team_profiles add column if not exists photo_focus text not null default '50% 30%';

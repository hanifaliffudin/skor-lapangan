begin;

alter table public.club_sessions
  drop constraint if exists club_sessions_sport_check;

alter table public.club_sessions
  add constraint club_sessions_sport_check
  check (sport in ('badminton', 'pickleball', 'tennis', 'padel', 'table_tennis', 'squash'));

notify pgrst, 'reload schema';

commit;

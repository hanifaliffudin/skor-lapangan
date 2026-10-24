begin;

alter table public.club_sessions
  add column if not exists pairing_mode text not null default 'open';

alter table public.club_sessions
  add constraint club_sessions_pairing_mode_check
  check (pairing_mode in ('open', 'mixed'));

alter table public.club_session_players
  add column if not exists gender text;

alter table public.club_session_players
  add column if not exists skill_level smallint not null default 3;

alter table public.club_session_players
  add column if not exists availability text not null default 'available';

alter table public.club_session_players
  add column if not exists avoid_player_ids uuid[] not null default '{}'::uuid[];

alter table public.club_session_matches
  add column if not exists is_open_fallback boolean not null default false;

alter table public.club_session_players
  add constraint club_session_players_gender_check
  check (gender is null or gender in ('man', 'woman', 'other', 'unspecified'));

alter table public.club_session_players
  add constraint club_session_players_skill_level_check
  check (skill_level between 1 and 5);

alter table public.club_session_players
  add constraint club_session_players_availability_check
  check (availability in ('available', 'late', 'resting', 'unavailable'));

notify pgrst, 'reload schema';

commit;

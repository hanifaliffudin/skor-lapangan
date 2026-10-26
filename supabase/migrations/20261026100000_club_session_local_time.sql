begin;

alter table public.club_sessions
  add column if not exists start_time time,
  add column if not exists time_zone text not null default 'UTC',
  add column if not exists location_name text;

alter table public.club_sessions
  add constraint club_sessions_time_zone_check
    check (char_length(btrim(time_zone)) between 1 and 80),
  add constraint club_sessions_location_name_check
    check (location_name is null or char_length(btrim(location_name)) between 1 and 120);

create index if not exists club_sessions_owner_schedule_idx
  on public.club_sessions(owner_id, session_date desc, start_time desc, created_at desc);

notify pgrst, 'reload schema';

commit;

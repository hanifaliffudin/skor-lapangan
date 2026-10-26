begin;

create or replace function public.is_valid_club_session_timezone(p_time_zone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_time_zone
  );
$$;

revoke all on function public.is_valid_club_session_timezone(text)
  from public, anon, authenticated;
grant execute on function public.is_valid_club_session_timezone(text)
  to authenticated;

alter table public.club_sessions
  drop constraint if exists club_sessions_time_zone_check,
  add constraint club_sessions_time_zone_check
    check (public.is_valid_club_session_timezone(time_zone));

create or replace function public.validate_club_session_match_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_record record;
  player_ids uuid[] := array[
    new.team_a_player_1,
    new.team_a_player_2,
    new.team_b_player_1,
    new.team_b_player_2
  ];
  required_players integer;
  player_count integer;
  distinct_player_count integer;
  active_player_count integer;
  team_a_men integer;
  team_a_women integer;
  team_b_men integer;
  team_b_women integer;
begin
  select cs.status, cs.pairing_mode, cs.play_profile
  into session_record
  from public.club_sessions cs
  where cs.id = new.session_id
    and cs.owner_id = new.owner_id;

  if not found then
    raise exception 'Club session assignment belongs to an unknown session.';
  end if;

  if session_record.status <> 'active' then
    raise exception 'Club session assignments require an active session.';
  end if;

  required_players := case session_record.play_profile
    when 'table_tennis_singles_short' then 2
    when 'squash_singles' then 2
    when 'badminton_doubles' then 4
    when 'pickleball_doubles' then 4
    when 'tennis_doubles' then 4
    when 'padel_doubles' then 4
    else 0
  end;

  if required_players = 0 then
    raise exception 'Club session has an unsupported play profile.';
  end if;

  if not exists (
    select 1
    from public.club_session_courts c
    where c.id = new.court_id
      and c.session_id = new.session_id
      and c.owner_id = new.owner_id
      and c.is_active
  ) then
    raise exception 'Club session assignments require an active court.';
  end if;

  select
    count(*) filter (where candidate.id is not null),
    count(distinct candidate.id),
    count(*) filter (where p.is_active)
  into player_count, distinct_player_count, active_player_count
  from unnest(player_ids) candidate(id)
  left join public.club_session_players p
    on p.id = candidate.id
   and p.session_id = new.session_id
   and p.owner_id = new.owner_id;

  if player_count <> required_players
     or distinct_player_count <> required_players
     or active_player_count <> required_players then
    raise exception 'Club session assignments require the exact active player count for the play profile.';
  end if;

  if session_record.pairing_mode = 'mixed'
     and required_players = 4
     and not new.is_open_fallback then
    select
      count(*) filter (where p.gender = 'man'),
      count(*) filter (where p.gender = 'woman')
    into team_a_men, team_a_women
    from public.club_session_players p
    where p.id in (new.team_a_player_1, new.team_a_player_2)
      and p.session_id = new.session_id
      and p.owner_id = new.owner_id;

    select
      count(*) filter (where p.gender = 'man'),
      count(*) filter (where p.gender = 'woman')
    into team_b_men, team_b_women
    from public.club_session_players p
    where p.id in (new.team_b_player_1, new.team_b_player_2)
      and p.session_id = new.session_id
      and p.owner_id = new.owner_id;

    if team_a_men <> 1 or team_a_women <> 1
       or team_b_men <> 1 or team_b_women <> 1 then
      raise exception 'Mixed club session assignments require one man and one woman per team, or an explicit open fallback.';
    end if;
  elsif new.is_open_fallback then
    raise exception 'Open fallback is only valid for mixed doubles sessions.';
  end if;

  return new;
end;
$$;

drop trigger if exists club_session_matches_validate_assignment
on public.club_session_matches;
create trigger club_session_matches_validate_assignment
before insert or update on public.club_session_matches
for each row execute function public.validate_club_session_match_assignment();

revoke all on function public.validate_club_session_match_assignment()
  from public, anon, authenticated;

create or replace function public.touch_club_session_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.club_sessions
  set updated_at = now()
  where id = coalesce(new.session_id, old.session_id)
    and owner_id = coalesce(new.owner_id, old.owner_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists club_session_players_touch_session
on public.club_session_players;
create trigger club_session_players_touch_session
after insert or update or delete on public.club_session_players
for each row execute function public.touch_club_session_updated_at();

drop trigger if exists club_session_courts_touch_session
on public.club_session_courts;
create trigger club_session_courts_touch_session
after insert or update or delete on public.club_session_courts
for each row execute function public.touch_club_session_updated_at();

drop trigger if exists club_session_matches_touch_session
on public.club_session_matches;
create trigger club_session_matches_touch_session
after insert or update or delete on public.club_session_matches
for each row execute function public.touch_club_session_updated_at();

revoke all on function public.touch_club_session_updated_at()
  from public, anon, authenticated;

create or replace function public.queue_club_session_matches(
  p_session_id uuid,
  p_expected_updated_at timestamptz,
  p_matches jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_record record;
  item jsonb;
  player_ids uuid[];
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'A durable account is required for Club Sessions.';
  end if;

  if p_matches is null
     or jsonb_typeof(p_matches) <> 'array'
     or jsonb_array_length(p_matches) > 50 then
    raise exception 'Invalid Club Session queue payload.';
  end if;

  select cs.id, cs.owner_id, cs.status, cs.updated_at
  into session_record
  from public.club_sessions cs
  where cs.id = p_session_id
    and cs.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'Club session was not found.';
  end if;
  if session_record.status <> 'active' then
    raise exception 'Club session assignments require an active session.';
  end if;
  if session_record.updated_at is distinct from p_expected_updated_at then
    raise exception 'CLUB_SESSION_ROTATION_STALE';
  end if;

  for item in select value from jsonb_array_elements(p_matches)
  loop
    player_ids := array(
      select value::uuid
      from jsonb_array_elements_text(coalesce(item -> 'playerIds', '[]'::jsonb))
      as player_values(value)
    );

    insert into public.club_session_matches (
      session_id,
      owner_id,
      match_id,
      court_id,
      team_a_player_1,
      team_a_player_2,
      team_b_player_1,
      team_b_player_2,
      queue_order,
      is_open_fallback
    ) values (
      p_session_id,
      auth.uid(),
      (item ->> 'matchId')::uuid,
      (item ->> 'courtId')::uuid,
      player_ids[1],
      case when coalesce(array_length(player_ids, 1), 0) = 4 then player_ids[2] end,
      case when coalesce(array_length(player_ids, 1), 0) >= 2 then player_ids[case when array_length(player_ids, 1) = 2 then 2 else 3 end] end,
      case when coalesce(array_length(player_ids, 1), 0) = 4 then player_ids[4] end,
      (item ->> 'queueOrder')::integer,
      coalesce((item ->> 'isOpenFallback')::boolean, false)
    );
  end loop;
end;
$$;

revoke all on function public.queue_club_session_matches(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.queue_club_session_matches(uuid, timestamptz, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
commit;

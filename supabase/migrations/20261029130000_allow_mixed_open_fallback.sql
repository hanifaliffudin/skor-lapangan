begin;

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
     and required_players = 4 then
    if not new.is_open_fallback then
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
    end if;
  elsif new.is_open_fallback then
    raise exception 'Open fallback is only valid for mixed doubles sessions.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_club_session_match_assignment()
  from public, anon, authenticated;

alter table public.club_session_matches
  drop constraint if exists club_session_matches_unique_players_check,
  add constraint club_session_matches_unique_players_check
    check (
      team_a_player_1 is not null
      and team_b_player_1 is not null
      and team_a_player_1 is distinct from team_b_player_1
      and (
        team_a_player_2 is null
        or (
          team_a_player_2 is distinct from team_a_player_1
          and team_a_player_2 is distinct from team_b_player_1
          and team_a_player_2 is distinct from team_b_player_2
        )
      )
      and (
        team_b_player_2 is null
        or (
          team_b_player_2 is distinct from team_a_player_1
          and team_b_player_2 is distinct from team_a_player_2
          and team_b_player_2 is distinct from team_b_player_1
        )
      )
    );

notify pgrst, 'reload schema';
commit;

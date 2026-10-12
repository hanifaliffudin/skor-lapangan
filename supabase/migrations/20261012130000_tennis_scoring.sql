alter table public.matches
  drop constraint if exists matches_sport_check,
  add constraint matches_sport_check
    check (sport in ('badminton', 'pickleball', 'tennis'));

alter table public.match_events
  drop constraint if exists match_events_event_type_check,
  add constraint match_events_event_type_check
    check (event_type in (
      'rally_awarded',
      'state_overridden',
      'undo_applied',
      'redo_applied',
      'tennis_set_orders_confirmed',
      'tennis_deciding_side_selected',
      'tennis_score_overridden'
    ));

create or replace function private.project_team_score(p_score jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'A', case when p_score ->> 'A' ~ '^[0-9]+$' then (p_score ->> 'A')::integer else 0 end,
    'B', case when p_score ->> 'B' ~ '^[0-9]+$' then (p_score ->> 'B')::integer else 0 end
  );
$$;

create or replace function private.project_tennis_orders(p_orders jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'serviceOrder', jsonb_build_object(
      'A', jsonb_build_array(
        case when p_orders #>> '{serviceOrder,A,0}' in ('0', '1') then (p_orders #> '{serviceOrder,A,0}') else '0'::jsonb end,
        case when p_orders #>> '{serviceOrder,A,1}' in ('0', '1') then (p_orders #> '{serviceOrder,A,1}') else '1'::jsonb end
      ),
      'B', jsonb_build_array(
        case when p_orders #>> '{serviceOrder,B,0}' in ('0', '1') then (p_orders #> '{serviceOrder,B,0}') else '0'::jsonb end,
        case when p_orders #>> '{serviceOrder,B,1}' in ('0', '1') then (p_orders #> '{serviceOrder,B,1}') else '1'::jsonb end
      )
    ),
    'deuceReceiver', jsonb_build_object(
      'A', case when p_orders #>> '{deuceReceiver,A}' in ('0', '1') then (p_orders #> '{deuceReceiver,A}') else '0'::jsonb end,
      'B', case when p_orders #>> '{deuceReceiver,B}' in ('0', '1') then (p_orders #> '{deuceReceiver,B}') else '0'::jsonb end
    )
  );
$$;

create or replace function private.project_completed_games(p_games jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'winner', case when game.value ->> 'winner' in ('A', 'B') then game.value -> 'winner' else 'null'::jsonb end,
      'score', private.project_team_score(game.value -> 'score')
    ) order by game.ordinality),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_games) = 'array' then p_games else '[]'::jsonb end
  ) with ordinality as game(value, ordinality);
$$;

create or replace function private.project_tennis_state(p_tennis jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when jsonb_typeof(p_tennis) is distinct from 'object' then null else jsonb_build_object(
    'setNumber', case when p_tennis ->> 'setNumber' ~ '^[1-9][0-9]*$' then (p_tennis ->> 'setNumber')::integer else 1 end,
    'setsWon', private.project_team_score(p_tennis -> 'setsWon'),
    'gamesInSet', private.project_team_score(p_tennis -> 'gamesInSet'),
    'pointScore', private.project_team_score(p_tennis -> 'pointScore'),
    'advantage', case when p_tennis ->> 'advantage' in ('A', 'B') then p_tennis -> 'advantage' else 'null'::jsonb end,
    'gamePointCount', case when p_tennis ->> 'gamePointCount' ~ '^[0-9]+$' then (p_tennis ->> 'gamePointCount')::integer else 0 end,
    'tieBreakScore', case when jsonb_typeof(p_tennis -> 'tieBreakScore') = 'object' then private.project_team_score(p_tennis -> 'tieBreakScore') else 'null'::jsonb end,
    'phase', case when p_tennis ->> 'phase' in ('game', 'tiebreak', 'match_tiebreak') then p_tennis -> 'phase' else '"game"'::jsonb end,
    'setOpeningServer', case when p_tennis ->> 'setOpeningServer' in ('A', 'B') then p_tennis -> 'setOpeningServer' else '"A"'::jsonb end,
    'setOrders', private.project_tennis_orders(p_tennis -> 'setOrders'),
    'serviceTurns', private.project_team_score(p_tennis -> 'serviceTurns'),
    'tieBreakFirstServer', case
      when p_tennis #>> '{tieBreakFirstServer,team}' in ('A', 'B')
        and p_tennis #>> '{tieBreakFirstServer,player}' in ('0', '1')
      then jsonb_build_object(
        'team', p_tennis #> '{tieBreakFirstServer,team}',
        'player', p_tennis #> '{tieBreakFirstServer,player}'
      )
      else 'null'::jsonb
    end,
    'tieBreakStartCourtEndsSwapped', p_tennis -> 'tieBreakStartCourtEndsSwapped' = 'true'::jsonb,
    'noAdReceivingSide', case when p_tennis ->> 'noAdReceivingSide' in ('left', 'right') then p_tennis -> 'noAdReceivingSide' else 'null'::jsonb end,
    'awaitingSetOrders', p_tennis -> 'awaitingSetOrders' = 'true'::jsonb,
    'courtEndsSwapped', p_tennis -> 'courtEndsSwapped' = 'true'::jsonb,
    'completedSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'winner', case when set_row.value ->> 'winner' in ('A', 'B') then set_row.value -> 'winner' else 'null'::jsonb end,
        'score', private.project_team_score(set_row.value -> 'score'),
        'tieBreakScore', case when jsonb_typeof(set_row.value -> 'tieBreakScore') = 'object' then private.project_team_score(set_row.value -> 'tieBreakScore') else 'null'::jsonb end,
        'matchTieBreak', set_row.value -> 'matchTieBreak' = 'true'::jsonb
      ) order by set_row.ordinality)
      from jsonb_array_elements(
        case when jsonb_typeof(p_tennis -> 'completedSets') = 'array' then p_tennis -> 'completedSets' else '[]'::jsonb end
      ) with ordinality as set_row(value, ordinality)
    ), '[]'::jsonb)
  ) end;
$$;

create or replace function private.project_live_match_state(p_state jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'matchId', p_state -> 'matchId',
    'sport', p_state -> 'sport',
    'format', case
      when p_state ->> 'format' in ('singles', 'doubles') then p_state -> 'format'
      when p_state ->> 'sport' = 'tennis' and p_state ->> 'format' = 'mixed_doubles' then p_state -> 'format'
      else '"doubles"'::jsonb
    end,
    'gameNumber', case when p_state ->> 'gameNumber' ~ '^[0-9]+$' then (p_state ->> 'gameNumber')::integer else 1 end,
    'gamesWon', private.project_team_score(p_state -> 'gamesWon'),
    'points', private.project_team_score(p_state -> 'points'),
    'servingTeam', case when p_state ->> 'servingTeam' in ('A', 'B') then p_state -> 'servingTeam' else '"A"'::jsonb end,
    'currentServer', case when p_state ->> 'currentServer' in ('0', '1') then (p_state ->> 'currentServer')::integer else 0 end,
    'serverNumber', case when p_state ->> 'serverNumber' in ('1', '2') then to_jsonb((p_state ->> 'serverNumber')::integer) else 'null'::jsonb end,
    'positions', jsonb_build_object(
      'A', jsonb_build_object(
        'left', case when p_state #>> '{positions,A,left}' in ('0', '1') then (p_state #> '{positions,A,left}') else '0'::jsonb end,
        'right', case when p_state #>> '{positions,A,right}' in ('0', '1') then (p_state #> '{positions,A,right}') else '1'::jsonb end
      ),
      'B', jsonb_build_object(
        'left', case when p_state #>> '{positions,B,left}' in ('0', '1') then (p_state #> '{positions,B,left}') else '0'::jsonb end,
        'right', case when p_state #>> '{positions,B,right}' in ('0', '1') then (p_state #> '{positions,B,right}') else '1'::jsonb end
      )
    ),
    'status', case when p_state ->> 'status' in ('active', 'complete') then p_state -> 'status' else '"active"'::jsonb end,
    'winner', case when p_state ->> 'winner' in ('A', 'B') then p_state -> 'winner' else 'null'::jsonb end,
    'completedGames', private.project_completed_games(p_state -> 'completedGames')
  ) || case
    when p_state ->> 'sport' = 'tennis'
      then jsonb_build_object('tennis', private.project_tennis_state(p_state -> 'tennis'))
    else '{}'::jsonb
  end;
$$;

revoke all on function private.project_team_score(jsonb) from public, anon, authenticated;
revoke all on function private.project_tennis_orders(jsonb) from public, anon, authenticated;
revoke all on function private.project_completed_games(jsonb) from public, anon, authenticated;
revoke all on function private.project_tennis_state(jsonb) from public, anon, authenticated;
revoke all on function private.project_live_match_state(jsonb) from public, anon, authenticated;

create or replace function public.sanitize_guest_match_payload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_guest then
    return new;
  end if;

  new.definition := jsonb_strip_nulls(jsonb_build_object(
    'id', new.definition -> 'id',
    'sport', new.definition -> 'sport',
    'format', case
      when new.definition ->> 'format' in ('singles', 'doubles') then new.definition -> 'format'
      when new.sport = 'tennis' and new.definition ->> 'format' = 'mixed_doubles' then new.definition -> 'format'
      else '"doubles"'::jsonb
    end,
    'rulesetId', new.definition -> 'rulesetId',
    'mode', new.definition -> 'mode',
    'createdAt', new.definition -> 'createdAt',
    'initialServingTeam', new.definition -> 'initialServingTeam',
    'initialServingPlayer', new.definition -> 'initialServingPlayer'
  )) || case
    when new.sport = 'tennis' then jsonb_build_object(
      'tennisSetOrders', private.project_tennis_orders(new.definition -> 'tennisSetOrders'),
      'ruleset', jsonb_build_object(
        'id', new.definition #> '{ruleset,id}',
        'name', '"ITF Rules of Tennis 2026"'::jsonb,
        'sport', '"tennis"'::jsonb,
        'format', new.definition #> '{ruleset,format}',
        'source', new.definition #> '{ruleset,source}',
        'version', new.definition #> '{ruleset,version}',
        'tennisConfiguration', jsonb_build_object(
          'bestOf', new.definition #> '{ruleset,tennisConfiguration,bestOf}',
          'gameScoring', new.definition #> '{ruleset,tennisConfiguration,gameScoring}',
          'setScoring', new.definition #> '{ruleset,tennisConfiguration,setScoring}',
          'finalSetScoring', new.definition #> '{ruleset,tennisConfiguration,finalSetScoring}',
          'matchTieBreakPoints', new.definition #> '{ruleset,tennisConfiguration,matchTieBreakPoints}'
        )
      )
    )
    else '{}'::jsonb
  end;

  new.current_state := private.project_live_match_state(new.current_state);
  return new;
end;
$$;

create or replace function public.sanitize_match_event_payload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type like 'tennis_%' and not exists (
    select 1 from public.matches m
    where m.id = new.match_id and m.owner_id = new.owner_id and m.sport = 'tennis'
  ) then
    raise exception 'Tennis events require a Tennis match.';
  end if;

  if new.event_type = 'rally_awarded' then
    new.payload := jsonb_build_object('team', case when new.payload ->> 'team' in ('A', 'B') then new.payload -> 'team' else '"A"'::jsonb end);
  elsif new.event_type = 'state_overridden' then
    new.payload := jsonb_build_object('points', private.project_team_score(new.payload -> 'points'));
  elsif new.event_type = 'tennis_set_orders_confirmed' then
    new.payload := jsonb_build_object('orders', private.project_tennis_orders(new.payload -> 'orders'));
  elsif new.event_type = 'tennis_deciding_side_selected' then
    new.payload := jsonb_build_object('side', case when new.payload ->> 'side' in ('left', 'right') then new.payload -> 'side' else '"right"'::jsonb end);
  elsif new.event_type = 'tennis_score_overridden' then
    new.payload := jsonb_build_object(
      'pointScore', private.project_team_score(new.payload -> 'pointScore'),
      'advantage', case when new.payload ->> 'advantage' in ('A', 'B') then new.payload -> 'advantage' else 'null'::jsonb end,
      'tieBreakScore', case when jsonb_typeof(new.payload -> 'tieBreakScore') = 'object' then private.project_team_score(new.payload -> 'tieBreakScore') else 'null'::jsonb end,
      'gamePointCount', case when new.payload ->> 'gamePointCount' ~ '^[0-9]+$' then (new.payload ->> 'gamePointCount')::integer else 0 end
    );
  else
    new.payload := jsonb_build_object('targetEventId', new.payload -> 'targetEventId');
  end if;
  return new;
end;
$$;

revoke all on function public.sanitize_guest_match_payload() from public, anon, authenticated;
revoke all on function public.sanitize_match_event_payload() from public, anon, authenticated;

create or replace function private.validate_tennis_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  match_format text;
  rules jsonb;
  tennis_state jsonb;
begin
  if new.sport <> 'tennis' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,tennisConfiguration}';
  tennis_state := new.current_state -> 'tennis';

  if new.definition ->> 'sport' is distinct from 'tennis'
     or coalesce(match_format, '') not in ('singles', 'doubles', 'mixed_doubles') then
    raise exception 'Tennis match format is invalid.';
  end if;
  if new.definition ? 'tennisLocalRoles' then
    raise exception 'Mixed-doubles roles must remain on the controlling device.';
  end if;
  if new.definition #>> '{ruleset,id}' is distinct from 'itf-tennis-2026'
     or new.definition #>> '{ruleset,sport}' is distinct from 'tennis'
     or new.definition #>> '{ruleset,source}' is distinct from 'official'
     or new.definition #>> '{ruleset,version}' is distinct from '1'
     or new.definition #>> '{ruleset,format}' is distinct from match_format then
    raise exception 'Tennis matches require the 2026 ITF rules snapshot.';
  end if;
  if coalesce(rules ->> 'bestOf', '') not in ('3', '5')
     or coalesce(rules ->> 'gameScoring', '') not in ('advantage', 'no_ad')
     or coalesce(rules ->> 'setScoring', '') not in ('tiebreak', 'advantage')
     or coalesce(rules ->> 'finalSetScoring', '') not in ('tiebreak', 'advantage', 'match_tiebreak')
     or coalesce(rules ->> 'matchTieBreakPoints', '') not in ('7', '10') then
    raise exception 'Tennis scoring format is invalid.';
  end if;
  if jsonb_typeof(tennis_state) is distinct from 'object'
     or coalesce(tennis_state ->> 'phase', '') not in ('game', 'tiebreak', 'match_tiebreak')
     or coalesce(tennis_state ->> 'setNumber', '') !~ '^[1-9][0-9]*$' then
    raise exception 'Tennis score state is invalid.';
  end if;
  if new.current_state ->> 'sport' is distinct from 'tennis'
     or new.current_state ->> 'format' is distinct from match_format
     or jsonb_typeof(tennis_state -> 'setsWon') is distinct from 'object'
     or jsonb_typeof(tennis_state -> 'gamesInSet') is distinct from 'object'
     or jsonb_typeof(tennis_state -> 'pointScore') is distinct from 'object'
     or jsonb_typeof(tennis_state -> 'setOrders') is distinct from 'object' then
    raise exception 'Tennis score projection is incomplete.';
  end if;
  if match_format = 'singles'
     and (coalesce(tennis_state #>> '{setOrders,serviceOrder,A,1}', '') <> '0'
       or coalesce(tennis_state #>> '{setOrders,serviceOrder,B,1}', '') <> '0') then
    raise exception 'Singles Tennis service orders may only contain player zero.';
  end if;
  if match_format <> 'singles' and (
    coalesce(tennis_state #>> '{setOrders,serviceOrder,A,0}', '') not in ('0', '1')
    or coalesce(tennis_state #>> '{setOrders,serviceOrder,A,1}', '') not in ('0', '1')
    or coalesce(tennis_state #>> '{setOrders,serviceOrder,B,0}', '') not in ('0', '1')
    or coalesce(tennis_state #>> '{setOrders,serviceOrder,B,1}', '') not in ('0', '1')
    or coalesce(tennis_state #>> '{setOrders,serviceOrder,A,0}', '') = coalesce(tennis_state #>> '{setOrders,serviceOrder,A,1}', '')
    or coalesce(tennis_state #>> '{setOrders,serviceOrder,B,0}', '') = coalesce(tennis_state #>> '{setOrders,serviceOrder,B,1}', '')
    or coalesce(tennis_state #>> '{setOrders,deuceReceiver,A}', '') not in ('0', '1')
    or coalesce(tennis_state #>> '{setOrders,deuceReceiver,B}', '') not in ('0', '1')
  ) then
    raise exception 'Tennis doubles orders are invalid.';
  end if;
  if coalesce(new.definition ->> 'initialServingTeam', '') not in ('A', 'B')
     or coalesce(new.definition ->> 'initialServingPlayer', '') not in ('0', '1')
     or coalesce(new.current_state ->> 'servingTeam', '') not in ('A', 'B')
     or coalesce(new.current_state ->> 'currentServer', '') not in ('0', '1') then
    raise exception 'Tennis server state is invalid.';
  end if;
  if match_format = 'singles' and new.definition ->> 'initialServingPlayer' <> '0' then
    raise exception 'Singles Tennis has one server per side.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_tennis_match_payload() from public, anon, authenticated;
drop trigger if exists matches_validate_tennis_payload on public.matches;
create trigger matches_validate_tennis_payload
before insert or update on public.matches
for each row execute function private.validate_tennis_match_payload();

create or replace function public.read_live_viewer(p_token text)
returns table (
  sport text,
  status text,
  current_state jsonb,
  updated_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_match public.matches%rowtype;
begin
  if p_token is null then
    return;
  end if;

  select m.* into viewer_match
  from public.matches m
  where m.viewer_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and m.viewer_revoked_at is null
    and m.viewer_expires_at > now()
    and (m.expires_at is null or m.expires_at > now())
  limit 1;

  if not found then
    return;
  end if;

  if not private.take_rate_limit(viewer_match.id::text, 'live_viewer_read', 600, 60) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT: live_viewer_read';
  end if;

  return query
  select viewer_match.sport,
         viewer_match.status,
         private.project_live_match_state(viewer_match.current_state),
         viewer_match.updated_at,
         viewer_match.viewer_expires_at;
end;
$$;

revoke all on function public.read_live_viewer(text) from public;
grant execute on function public.read_live_viewer(text) to anon, authenticated;

notify pgrst, 'reload schema';

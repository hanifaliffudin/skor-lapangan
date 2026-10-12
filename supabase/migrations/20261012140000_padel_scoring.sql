begin;

alter table public.matches
  drop constraint if exists matches_sport_check,
  add constraint matches_sport_check
    check (sport in ('badminton', 'pickleball', 'tennis', 'padel'));

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
      'tennis_score_overridden',
      'padel_set_orders_confirmed',
      'padel_deciding_side_selected',
      'padel_score_overridden'
    ));

create or replace function private.project_padel_orders(p_orders jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'serviceOrder', jsonb_build_object(
      'A', jsonb_build_array(
        case when p_orders #>> '{serviceOrder,A,0}' in ('0', '1') then p_orders #> '{serviceOrder,A,0}' else '0'::jsonb end,
        case when p_orders #>> '{serviceOrder,A,1}' in ('0', '1') then p_orders #> '{serviceOrder,A,1}' else '0'::jsonb end
      ),
      'B', jsonb_build_array(
        case when p_orders #>> '{serviceOrder,B,0}' in ('0', '1') then p_orders #> '{serviceOrder,B,0}' else '0'::jsonb end,
        case when p_orders #>> '{serviceOrder,B,1}' in ('0', '1') then p_orders #> '{serviceOrder,B,1}' else '0'::jsonb end
      )
    ),
    'deuceReceiver', jsonb_build_object(
      'A', case when p_orders #>> '{deuceReceiver,A}' in ('0', '1') then p_orders #> '{deuceReceiver,A}' else '0'::jsonb end,
      'B', case when p_orders #>> '{deuceReceiver,B}' in ('0', '1') then p_orders #> '{deuceReceiver,B}' else '0'::jsonb end
    )
  );
$$;

create or replace function private.project_padel_state(p_padel jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when jsonb_typeof(p_padel) is distinct from 'object' then null else jsonb_build_object(
    'gameScoring', case when p_padel ->> 'gameScoring' in ('advantage', 'star_point', 'golden_point') then p_padel -> 'gameScoring' else '"advantage"'::jsonb end,
    'setNumber', case when p_padel ->> 'setNumber' ~ '^[1-9][0-9]*$' then (p_padel ->> 'setNumber')::integer else 1 end,
    'setsWon', private.project_team_score(p_padel -> 'setsWon'),
    'gamesInSet', private.project_team_score(p_padel -> 'gamesInSet'),
    'pointScore', private.project_team_score(p_padel -> 'pointScore'),
    'advantage', case when p_padel ->> 'advantage' in ('A', 'B') then p_padel -> 'advantage' else 'null'::jsonb end,
    'starDeuces', case when p_padel ->> 'starDeuces' ~ '^[0-2]$' then (p_padel ->> 'starDeuces')::integer else 0 end,
    'gamePointCount', case when p_padel ->> 'gamePointCount' ~ '^[0-9]+$' then (p_padel ->> 'gamePointCount')::integer else 0 end,
    'tieBreakScore', case when jsonb_typeof(p_padel -> 'tieBreakScore') = 'object' then private.project_team_score(p_padel -> 'tieBreakScore') else 'null'::jsonb end,
    'phase', case when p_padel ->> 'phase' in ('game', 'tiebreak', 'match_tiebreak') then p_padel -> 'phase' else '"game"'::jsonb end,
    'setOpeningServer', case when p_padel ->> 'setOpeningServer' in ('A', 'B') then p_padel -> 'setOpeningServer' else '"A"'::jsonb end,
    'setOrders', private.project_padel_orders(p_padel -> 'setOrders'),
    'serviceTurns', private.project_team_score(p_padel -> 'serviceTurns'),
    'tieBreakFirstServer', case
      when p_padel #>> '{tieBreakFirstServer,team}' in ('A', 'B')
        and p_padel #>> '{tieBreakFirstServer,player}' in ('0', '1')
      then jsonb_build_object(
        'team', p_padel #> '{tieBreakFirstServer,team}',
        'player', p_padel #> '{tieBreakFirstServer,player}'
      )
      else 'null'::jsonb
    end,
    'tieBreakStartCourtEndsSwapped', p_padel -> 'tieBreakStartCourtEndsSwapped' = 'true'::jsonb,
    'decidingReceivingSide', case when p_padel ->> 'decidingReceivingSide' in ('left', 'right') then p_padel -> 'decidingReceivingSide' else 'null'::jsonb end,
    'awaitingSetOrders', p_padel -> 'awaitingSetOrders' = 'true'::jsonb,
    'courtEndsSwapped', p_padel -> 'courtEndsSwapped' = 'true'::jsonb,
    'completedSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'winner', case when set_row.value ->> 'winner' in ('A', 'B') then set_row.value -> 'winner' else 'null'::jsonb end,
        'score', private.project_team_score(set_row.value -> 'score'),
        'tieBreakScore', case when jsonb_typeof(set_row.value -> 'tieBreakScore') = 'object' then private.project_team_score(set_row.value -> 'tieBreakScore') else 'null'::jsonb end,
        'matchTieBreak', set_row.value -> 'matchTieBreak' = 'true'::jsonb
      ) order by set_row.ordinality)
      from jsonb_array_elements(
        case when jsonb_typeof(p_padel -> 'completedSets') = 'array' then p_padel -> 'completedSets' else '[]'::jsonb end
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
      when p_state ->> 'sport' in ('tennis', 'padel') and p_state ->> 'format' = 'mixed_doubles' then p_state -> 'format'
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
        'left', case when p_state #>> '{positions,A,left}' in ('0', '1') then p_state #> '{positions,A,left}' else '0'::jsonb end,
        'right', case when p_state #>> '{positions,A,right}' in ('0', '1') then p_state #> '{positions,A,right}' else '1'::jsonb end
      ),
      'B', jsonb_build_object(
        'left', case when p_state #>> '{positions,B,left}' in ('0', '1') then p_state #> '{positions,B,left}' else '0'::jsonb end,
        'right', case when p_state #>> '{positions,B,right}' in ('0', '1') then p_state #> '{positions,B,right}' else '1'::jsonb end
      )
    ),
    'status', case when p_state ->> 'status' in ('active', 'complete') then p_state -> 'status' else '"active"'::jsonb end,
    'winner', case when p_state ->> 'winner' in ('A', 'B') then p_state -> 'winner' else 'null'::jsonb end,
    'completedGames', private.project_completed_games(p_state -> 'completedGames')
  ) || case
    when p_state ->> 'sport' = 'tennis'
      then jsonb_build_object('tennis', private.project_tennis_state(p_state -> 'tennis'))
    when p_state ->> 'sport' = 'padel'
      then jsonb_build_object('padel', private.project_padel_state(p_state -> 'padel'))
    else '{}'::jsonb
  end;
$$;

revoke all on function private.project_padel_orders(jsonb) from public, anon, authenticated;
revoke all on function private.project_padel_state(jsonb) from public, anon, authenticated;
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
      when new.sport in ('tennis', 'padel') and new.definition ->> 'format' = 'mixed_doubles' then new.definition -> 'format'
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
    when new.sport = 'padel' then jsonb_build_object(
      'padelSetOrders', private.project_padel_orders(new.definition -> 'padelSetOrders'),
      'ruleset', jsonb_build_object(
        'id', new.definition #> '{ruleset,id}',
        'name', case when new.definition #>> '{ruleset,id}' = 'club-padel-singles-2026'
          then '"Club Padel Singles (FIP-derived scoring)"'::jsonb
          else '"FIP Rules of Padel 2026"'::jsonb
        end,
        'sport', '"padel"'::jsonb,
        'format', new.definition #> '{ruleset,format}',
        'source', new.definition #> '{ruleset,source}',
        'version', new.definition #> '{ruleset,version}',
        'padelConfiguration', jsonb_build_object(
          'gameScoring', new.definition #> '{ruleset,padelConfiguration,gameScoring}',
          'setScoring', new.definition #> '{ruleset,padelConfiguration,setScoring}',
          'finalSetScoring', new.definition #> '{ruleset,padelConfiguration,finalSetScoring}',
          'matchTieBreakPoints', new.definition #> '{ruleset,padelConfiguration,matchTieBreakPoints}'
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
  if new.event_type like 'padel_%' and not exists (
    select 1 from public.matches m
    where m.id = new.match_id and m.owner_id = new.owner_id and m.sport = 'padel'
  ) then
    raise exception 'Padel events require a Padel match.';
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
  elsif new.event_type = 'padel_set_orders_confirmed' then
    new.payload := jsonb_build_object('orders', private.project_padel_orders(new.payload -> 'orders'));
  elsif new.event_type = 'padel_deciding_side_selected' then
    new.payload := jsonb_build_object('side', case when new.payload ->> 'side' in ('left', 'right') then new.payload -> 'side' else '"right"'::jsonb end);
  elsif new.event_type = 'padel_score_overridden' then
    new.payload := jsonb_build_object(
      'pointScore', private.project_team_score(new.payload -> 'pointScore'),
      'advantage', case when new.payload ->> 'advantage' in ('A', 'B') then new.payload -> 'advantage' else 'null'::jsonb end,
      'starDeuces', case when new.payload ->> 'starDeuces' ~ '^[0-2]$' then (new.payload ->> 'starDeuces')::integer else 0 end,
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

create or replace function private.validate_padel_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  match_format text;
  rules jsonb;
  padel_state jsonb;
  expected_ruleset text;
  expected_source text;
begin
  if new.sport <> 'padel' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,padelConfiguration}';
  padel_state := new.current_state -> 'padel';
  expected_ruleset := case when match_format = 'singles' then 'club-padel-singles-2026' else 'fip-padel-2026' end;
  expected_source := case when match_format = 'singles' then 'local_variant' else 'official' end;

  if new.definition ->> 'sport' is distinct from 'padel'
     or coalesce(match_format, '') not in ('singles', 'doubles', 'mixed_doubles') then
    raise exception 'Padel match format is invalid.';
  end if;
  if new.definition ? 'padelLocalRoles' then
    raise exception 'Mixed-doubles roles must remain on the controlling device.';
  end if;
  if new.definition #>> '{ruleset,id}' is distinct from expected_ruleset
     or new.definition #>> '{ruleset,sport}' is distinct from 'padel'
     or new.definition #>> '{ruleset,source}' is distinct from expected_source
     or new.definition #>> '{ruleset,version}' is distinct from '1'
     or new.definition #>> '{ruleset,format}' is distinct from match_format then
    raise exception 'Padel matches require the selected FIP or club-variant rules snapshot.';
  end if;
  if coalesce(rules ->> 'gameScoring', '') not in ('advantage', 'star_point', 'golden_point')
     or coalesce(rules ->> 'setScoring', '') not in ('standard', 'mini')
     or coalesce(rules ->> 'finalSetScoring', '') not in ('standard', 'advantage', 'match_tiebreak')
     or coalesce(rules ->> 'matchTieBreakPoints', '') not in ('7', '10') then
    raise exception 'Padel scoring format is invalid.';
  end if;
  if jsonb_typeof(padel_state) is distinct from 'object'
     or coalesce(padel_state ->> 'phase', '') not in ('game', 'tiebreak', 'match_tiebreak')
     or coalesce(padel_state ->> 'setNumber', '') !~ '^[1-9][0-9]*$' then
    raise exception 'Padel score state is invalid.';
  end if;
  if new.current_state ->> 'sport' is distinct from 'padel'
     or new.current_state ->> 'format' is distinct from match_format
     or jsonb_typeof(padel_state -> 'setsWon') is distinct from 'object'
     or jsonb_typeof(padel_state -> 'gamesInSet') is distinct from 'object'
     or jsonb_typeof(padel_state -> 'pointScore') is distinct from 'object'
     or jsonb_typeof(padel_state -> 'setOrders') is distinct from 'object' then
    raise exception 'Padel score projection is incomplete.';
  end if;
  if match_format = 'singles' and (
    coalesce(padel_state #>> '{setOrders,serviceOrder,A,0}', '') <> '0'
    or coalesce(padel_state #>> '{setOrders,serviceOrder,A,1}', '') <> '0'
    or coalesce(padel_state #>> '{setOrders,serviceOrder,B,0}', '') <> '0'
    or coalesce(padel_state #>> '{setOrders,serviceOrder,B,1}', '') <> '0'
    or coalesce(padel_state #>> '{setOrders,deuceReceiver,A}', '') <> '0'
    or coalesce(padel_state #>> '{setOrders,deuceReceiver,B}', '') <> '0'
  ) then
    raise exception 'Club singles service orders may only contain player zero.';
  end if;
  if match_format <> 'singles' and (
    coalesce(padel_state #>> '{setOrders,serviceOrder,A,0}', '') not in ('0', '1')
    or coalesce(padel_state #>> '{setOrders,serviceOrder,A,1}', '') not in ('0', '1')
    or coalesce(padel_state #>> '{setOrders,serviceOrder,B,0}', '') not in ('0', '1')
    or coalesce(padel_state #>> '{setOrders,serviceOrder,B,1}', '') not in ('0', '1')
    or coalesce(padel_state #>> '{setOrders,serviceOrder,A,0}', '') = coalesce(padel_state #>> '{setOrders,serviceOrder,A,1}', '')
    or coalesce(padel_state #>> '{setOrders,serviceOrder,B,0}', '') = coalesce(padel_state #>> '{setOrders,serviceOrder,B,1}', '')
    or coalesce(padel_state #>> '{setOrders,deuceReceiver,A}', '') not in ('0', '1')
    or coalesce(padel_state #>> '{setOrders,deuceReceiver,B}', '') not in ('0', '1')
  ) then
    raise exception 'Padel doubles orders are invalid.';
  end if;
  if coalesce(new.definition ->> 'initialServingTeam', '') not in ('A', 'B')
     or coalesce(new.definition ->> 'initialServingPlayer', '') not in ('0', '1')
     or coalesce(new.current_state ->> 'servingTeam', '') not in ('A', 'B')
     or coalesce(new.current_state ->> 'currentServer', '') not in ('0', '1') then
    raise exception 'Padel server state is invalid.';
  end if;
  if match_format = 'singles' and new.definition ->> 'initialServingPlayer' <> '0' then
    raise exception 'Club singles has one server per side.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_padel_match_payload() from public, anon, authenticated;
drop trigger if exists matches_validate_padel_payload on public.matches;
create trigger matches_validate_padel_payload
before insert or update on public.matches
for each row execute function private.validate_padel_match_payload();

notify pgrst, 'reload schema';
commit;

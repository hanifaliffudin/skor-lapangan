begin;

alter table public.matches
  drop constraint if exists matches_sport_check,
  add constraint matches_sport_check
    check (sport in ('badminton', 'pickleball', 'tennis', 'padel', 'table_tennis'));

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
      'padel_score_overridden',
      'table_tennis_game_orders_confirmed'
    ));

create or replace function private.project_table_tennis_orders(p_orders jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'firstServer', jsonb_build_object(
      'team', case when p_orders #>> '{firstServer,team}' in ('A', 'B') then p_orders #> '{firstServer,team}' else '"A"'::jsonb end,
      'player', case when p_orders #>> '{firstServer,player}' in ('0', '1') then p_orders #> '{firstServer,player}' else '0'::jsonb end
    ),
    'firstReceiver', jsonb_build_object(
      'team', case when p_orders #>> '{firstReceiver,team}' in ('A', 'B') then p_orders #> '{firstReceiver,team}' else '"B"'::jsonb end,
      'player', case when p_orders #>> '{firstReceiver,player}' in ('0', '1') then p_orders #> '{firstReceiver,player}' else '0'::jsonb end
    )
  );
$$;

create or replace function private.project_table_tennis_state(p_table_tennis jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when jsonb_typeof(p_table_tennis) is distinct from 'object' then null else jsonb_build_object(
    'gameOrders', private.project_table_tennis_orders(p_table_tennis -> 'gameOrders'),
    'currentReceiver', case when p_table_tennis ->> 'currentReceiver' in ('0', '1') then (p_table_tennis ->> 'currentReceiver')::integer else 0 end,
    'awaitingGameOrders', p_table_tennis -> 'awaitingGameOrders' = 'true'::jsonb,
    'courtEndsSwapped', p_table_tennis -> 'courtEndsSwapped' = 'true'::jsonb,
    'receivingOrderSwapped', p_table_tennis -> 'receivingOrderSwapped' = 'true'::jsonb
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
    when p_state ->> 'sport' = 'table_tennis'
      then jsonb_build_object('tableTennis', private.project_table_tennis_state(p_state -> 'tableTennis'))
    else '{}'::jsonb
  end;
$$;

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
        'tennisConfiguration', new.definition #> '{ruleset,tennisConfiguration}'
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
        'padelConfiguration', new.definition #> '{ruleset,padelConfiguration}'
      )
    )
    when new.sport = 'table_tennis' then jsonb_build_object(
      'tableTennisOrders', private.project_table_tennis_orders(new.definition -> 'tableTennisOrders'),
      'ruleset', jsonb_build_object(
        'id', '"ittf-table-tennis-2022"'::jsonb,
        'name', '"ITTF Laws of Table Tennis 2022"'::jsonb,
        'sport', '"table_tennis"'::jsonb,
        'format', new.definition #> '{ruleset,format}',
        'source', '"official"'::jsonb,
        'version', '1'::jsonb,
        'tableTennisConfiguration', jsonb_build_object(
          'bestOf', case when new.definition #>> '{ruleset,tableTennisConfiguration,bestOf}' in ('3', '5')
            then new.definition #> '{ruleset,tableTennisConfiguration,bestOf}' else '3'::jsonb end
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
  if new.event_type = 'table_tennis_game_orders_confirmed' and not exists (
    select 1 from public.matches m
    where m.id = new.match_id and m.owner_id = new.owner_id and m.sport = 'table_tennis'
  ) then
    raise exception 'Table tennis events require a Table tennis match.';
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
  elsif new.event_type = 'table_tennis_game_orders_confirmed' then
    new.payload := jsonb_build_object('orders', private.project_table_tennis_orders(new.payload -> 'orders'));
  else
    new.payload := jsonb_build_object('targetEventId', new.payload -> 'targetEventId');
  end if;
  return new;
end;
$$;

create or replace function private.validate_table_tennis_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  match_format text;
  rules jsonb;
  orders jsonb;
  table_tennis_state jsonb;
begin
  if new.sport <> 'table_tennis' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,tableTennisConfiguration}';
  orders := new.definition -> 'tableTennisOrders';
  table_tennis_state := new.current_state -> 'tableTennis';

  if new.definition ->> 'sport' is distinct from 'table_tennis'
     or coalesce(match_format, '') not in ('singles', 'doubles') then
    raise exception 'Table tennis match format is invalid.';
  end if;
  if new.definition #>> '{ruleset,id}' is distinct from 'ittf-table-tennis-2022'
     or new.definition #>> '{ruleset,sport}' is distinct from 'table_tennis'
     or new.definition #>> '{ruleset,source}' is distinct from 'official'
     or new.definition #>> '{ruleset,version}' is distinct from '1'
     or new.definition #>> '{ruleset,format}' is distinct from match_format then
    raise exception 'Table tennis matches require the ITTF rules snapshot.';
  end if;
  if coalesce(rules ->> 'bestOf', '') not in ('3', '5') then
    raise exception 'Table tennis best-of format is invalid.';
  end if;
  if jsonb_typeof(orders) is distinct from 'object'
     or orders #>> '{firstServer,team}' not in ('A', 'B')
     or orders #>> '{firstReceiver,team}' not in ('A', 'B')
     or orders #>> '{firstServer,player}' not in ('0', '1')
     or orders #>> '{firstReceiver,player}' not in ('0', '1')
     or orders #>> '{firstServer,team}' = orders #>> '{firstReceiver,team}' then
    raise exception 'Table tennis game orders are invalid.';
  end if;
  if match_format = 'singles' and (
    orders #>> '{firstServer,player}' <> '0'
    or orders #>> '{firstReceiver,player}' <> '0'
  ) then
    raise exception 'Table tennis singles orders may only contain player zero.';
  end if;
  if jsonb_typeof(table_tennis_state) is distinct from 'object'
     or jsonb_typeof(table_tennis_state -> 'gameOrders') is distinct from 'object'
     or table_tennis_state ->> 'currentReceiver' not in ('0', '1')
     or new.current_state ->> 'sport' is distinct from 'table_tennis'
     or new.current_state ->> 'format' is distinct from match_format then
    raise exception 'Table tennis score projection is incomplete.';
  end if;
  if coalesce(new.definition ->> 'initialServingTeam', '') not in ('A', 'B')
     or coalesce(new.definition ->> 'initialServingPlayer', '') not in ('0', '1')
     or coalesce(new.current_state ->> 'servingTeam', '') not in ('A', 'B')
     or coalesce(new.current_state ->> 'currentServer', '') not in ('0', '1') then
    raise exception 'Table tennis server state is invalid.';
  end if;
  if match_format = 'singles' and (
    new.definition ->> 'initialServingPlayer' <> '0'
    or new.current_state ->> 'currentServer' <> '0'
    or table_tennis_state ->> 'currentReceiver' <> '0'
  ) then
    raise exception 'Table tennis singles has one player per side.';
  end if;
  return new;
end;
$$;

revoke all on function private.project_table_tennis_orders(jsonb) from public, anon, authenticated;
revoke all on function private.project_table_tennis_state(jsonb) from public, anon, authenticated;
revoke all on function private.validate_table_tennis_match_payload() from public, anon, authenticated;
drop trigger if exists matches_validate_table_tennis_payload on public.matches;
create trigger matches_validate_table_tennis_payload
before insert or update on public.matches
for each row execute function private.validate_table_tennis_match_payload();

notify pgrst, 'reload schema';
commit;

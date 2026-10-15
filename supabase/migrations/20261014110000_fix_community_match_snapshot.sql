create or replace function public.sanitize_guest_match_payload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $community_payload_fix$
declare
  community_ruleset jsonb;
begin
  if not new.is_guest then
    return new;
  end if;

  community_ruleset := case
    when new.definition -> 'ruleset' ->> 'source' = 'community' then
      jsonb_strip_nulls(jsonb_build_object(
        'id', new.definition -> 'ruleset' -> 'id',
        'name', new.definition -> 'ruleset' -> 'name',
        'sport', new.definition -> 'ruleset' -> 'sport',
        'format', new.definition -> 'ruleset' -> 'format',
        'source', new.definition -> 'ruleset' -> 'source',
        'version', new.definition -> 'ruleset' -> 'version',
        'configuration', new.definition -> 'ruleset' -> 'configuration',
        'tennisConfiguration', new.definition -> 'ruleset' -> 'tennisConfiguration',
        'padelConfiguration', new.definition -> 'ruleset' -> 'padelConfiguration',
        'tableTennisConfiguration', new.definition -> 'ruleset' -> 'tableTennisConfiguration',
        'squashConfiguration', new.definition -> 'ruleset' -> 'squashConfiguration'
      ))
    else null
  end;

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
    when community_ruleset is not null then
      case
        when new.sport = 'tennis' then jsonb_build_object(
          'tennisSetOrders', private.project_tennis_orders(new.definition -> 'tennisSetOrders'),
          'ruleset', community_ruleset
        )
        when new.sport = 'padel' then jsonb_build_object(
          'padelSetOrders', private.project_padel_orders(new.definition -> 'padelSetOrders'),
          'ruleset', community_ruleset
        )
        when new.sport = 'table_tennis' then jsonb_build_object(
          'tableTennisOrders', private.project_table_tennis_orders(new.definition -> 'tableTennisOrders'),
          'ruleset', community_ruleset
        )
        when new.sport = 'squash' then jsonb_build_object(
          'squashGameOrders', private.project_squash_orders(new.definition -> 'squashGameOrders'),
          'ruleset', community_ruleset
        )
        else jsonb_build_object('ruleset', community_ruleset)
      end
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
        'name', case when new.definition #>> '{ruleset,id}' = 'club-padel-singles-2026' then '"Club Padel Singles (FIP-derived scoring)"'::jsonb else '"FIP Rules of Padel 2026"'::jsonb end,
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
          'bestOf', case when new.definition #>> '{ruleset,tableTennisConfiguration,bestOf}' in ('3', '5') then new.definition #> '{ruleset,tableTennisConfiguration,bestOf}' else '3'::jsonb end
        )
      )
    )
    when new.sport = 'squash' then jsonb_build_object(
      'squashGameOrders', private.project_squash_orders(new.definition -> 'squashGameOrders'),
      'ruleset', jsonb_build_object(
        'id', case when new.definition #>> '{ruleset,id}' in ('wsf-squash-singles-2025', 'wsf-squash-doubles-2022') then new.definition #> '{ruleset,id}' else '"wsf-squash-singles-2025"'::jsonb end,
        'name', case when new.definition #>> '{ruleset,id}' = 'wsf-squash-doubles-2022' then '"World Squash Doubles Rules 2022"'::jsonb else '"World Squash Singles Rules 2025"'::jsonb end,
        'sport', '"squash"'::jsonb,
        'format', new.definition #> '{ruleset,format}',
        'source', '"official"'::jsonb,
        'version', '1'::jsonb,
        'squashConfiguration', jsonb_build_object(
          'bestOf', case when new.definition #>> '{ruleset,squashConfiguration,bestOf}' in ('3', '5') then new.definition #> '{ruleset,squashConfiguration,bestOf}' else '5'::jsonb end
        )
      )
    )
    else '{}'::jsonb
  end;

  new.current_state := private.project_live_match_state(new.current_state);
  return new;
end;
$community_payload_fix$;

create or replace function private.validate_tennis_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $community_tennis_fix$
declare
  match_format text;
  rules jsonb;
  tennis_state jsonb;
  community_snapshot boolean;
begin
  if new.sport <> 'tennis' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,tennisConfiguration}';
  tennis_state := new.current_state -> 'tennis';
  community_snapshot := new.definition #>> '{ruleset,source}' = 'community';

  if new.definition ->> 'sport' is distinct from 'tennis'
     or coalesce(match_format, '') not in ('singles', 'doubles', 'mixed_doubles') then
    raise exception 'Tennis match format is invalid.';
  end if;
  if new.definition ? 'tennisLocalRoles' then
    raise exception 'Mixed-doubles roles must remain on the controlling device.';
  end if;
  if new.definition #>> '{ruleset,sport}' is distinct from 'tennis'
     or new.definition #>> '{ruleset,format}' is distinct from match_format
     or (community_snapshot and (
       coalesce(new.definition #>> '{ruleset,id}', '') = ''
       or coalesce(new.definition #>> '{ruleset,version}', '') !~ '^[1-9][0-9]*$'
     ))
     or (not community_snapshot and (
       new.definition #>> '{ruleset,id}' is distinct from 'itf-tennis-2026'
       or new.definition #>> '{ruleset,source}' is distinct from 'official'
       or new.definition #>> '{ruleset,version}' is distinct from '1'
     )) then
    raise exception 'Tennis matches require a valid rules snapshot.';
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
$community_tennis_fix$;

create or replace function private.validate_padel_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $community_padel_fix$
declare
  match_format text;
  rules jsonb;
  padel_state jsonb;
  expected_ruleset text;
  expected_source text;
  community_snapshot boolean;
begin
  if new.sport <> 'padel' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,padelConfiguration}';
  padel_state := new.current_state -> 'padel';
  expected_ruleset := case when match_format = 'singles' then 'club-padel-singles-2026' else 'fip-padel-2026' end;
  expected_source := case when match_format = 'singles' then 'local_variant' else 'official' end;
  community_snapshot := new.definition #>> '{ruleset,source}' = 'community';

  if new.definition ->> 'sport' is distinct from 'padel'
     or coalesce(match_format, '') not in ('singles', 'doubles', 'mixed_doubles') then
    raise exception 'Padel match format is invalid.';
  end if;
  if new.definition ? 'padelLocalRoles' then
    raise exception 'Mixed-doubles roles must remain on the controlling device.';
  end if;
  if new.definition #>> '{ruleset,sport}' is distinct from 'padel'
     or new.definition #>> '{ruleset,format}' is distinct from match_format
     or (community_snapshot and (
       coalesce(new.definition #>> '{ruleset,id}', '') = ''
       or coalesce(new.definition #>> '{ruleset,version}', '') !~ '^[1-9][0-9]*$'
     ))
     or (not community_snapshot and (
       new.definition #>> '{ruleset,id}' is distinct from expected_ruleset
       or new.definition #>> '{ruleset,source}' is distinct from expected_source
       or new.definition #>> '{ruleset,version}' is distinct from '1'
     )) then
    raise exception 'Padel matches require a valid rules snapshot.';
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
$community_padel_fix$;

create or replace function private.validate_table_tennis_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $community_table_tennis_fix$
declare
  match_format text;
  rules jsonb;
  orders jsonb;
  table_tennis_state jsonb;
  community_snapshot boolean;
begin
  if new.sport <> 'table_tennis' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,tableTennisConfiguration}';
  orders := new.definition -> 'tableTennisOrders';
  table_tennis_state := new.current_state -> 'tableTennis';
  community_snapshot := new.definition #>> '{ruleset,source}' = 'community';

  if new.definition ->> 'sport' is distinct from 'table_tennis'
     or coalesce(match_format, '') not in ('singles', 'doubles') then
    raise exception 'Table tennis match format is invalid.';
  end if;
  if new.definition #>> '{ruleset,sport}' is distinct from 'table_tennis'
     or new.definition #>> '{ruleset,format}' is distinct from match_format
     or (community_snapshot and (
       coalesce(new.definition #>> '{ruleset,id}', '') = ''
       or coalesce(new.definition #>> '{ruleset,version}', '') !~ '^[1-9][0-9]*$'
     ))
     or (not community_snapshot and (
       new.definition #>> '{ruleset,id}' is distinct from 'ittf-table-tennis-2022'
       or new.definition #>> '{ruleset,source}' is distinct from 'official'
       or new.definition #>> '{ruleset,version}' is distinct from '1'
     )) then
    raise exception 'Table tennis matches require a valid rules snapshot.';
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
$community_table_tennis_fix$;

create or replace function private.validate_squash_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $community_squash_fix$
declare
  match_format text;
  rules jsonb;
  orders jsonb;
  squash_state jsonb;
  expected_ruleset text;
  community_snapshot boolean;
begin
  if new.sport <> 'squash' then
    return new;
  end if;

  match_format := new.definition ->> 'format';
  rules := new.definition #> '{ruleset,squashConfiguration}';
  orders := new.definition -> 'squashGameOrders';
  squash_state := new.current_state -> 'squash';
  expected_ruleset := case when match_format = 'singles' then 'wsf-squash-singles-2025' else 'wsf-squash-doubles-2022' end;
  community_snapshot := new.definition #>> '{ruleset,source}' = 'community';

  if new.definition ->> 'sport' is distinct from 'squash'
     or coalesce(match_format, '') not in ('singles', 'doubles') then
    raise exception 'Squash match format is invalid.';
  end if;
  if new.definition #>> '{ruleset,sport}' is distinct from 'squash'
     or new.definition #>> '{ruleset,format}' is distinct from match_format
     or (community_snapshot and (
       coalesce(new.definition #>> '{ruleset,id}', '') = ''
       or coalesce(new.definition #>> '{ruleset,version}', '') !~ '^[1-9][0-9]*$'
     ))
     or (not community_snapshot and (
       new.definition #>> '{ruleset,id}' is distinct from expected_ruleset
       or new.definition #>> '{ruleset,source}' is distinct from 'official'
       or new.definition #>> '{ruleset,version}' is distinct from '1'
     )) then
    raise exception 'Squash matches require a valid rules snapshot.';
  end if;
  if coalesce(rules ->> 'bestOf', '') not in ('3', '5') then
    raise exception 'Squash best-of format is invalid.';
  end if;
  if jsonb_typeof(orders) is distinct from 'object'
     or orders #>> '{openingServiceBox}' not in ('left', 'right')
     or orders #>> '{serviceOrder,A,0}' not in ('0', '1')
     or orders #>> '{serviceOrder,A,1}' not in ('0', '1')
     or orders #>> '{serviceOrder,B,0}' not in ('0', '1')
     or orders #>> '{serviceOrder,B,1}' not in ('0', '1')
     or orders #>> '{receiverBySide,A,left}' not in ('0', '1')
     or orders #>> '{receiverBySide,A,right}' not in ('0', '1')
     or orders #>> '{receiverBySide,B,left}' not in ('0', '1')
     or orders #>> '{receiverBySide,B,right}' not in ('0', '1') then
    raise exception 'Squash game orders are invalid.';
  end if;
  if match_format = 'singles' and (
    orders #>> '{serviceOrder,A,0}' <> '0' or orders #>> '{serviceOrder,A,1}' <> '0'
    or orders #>> '{serviceOrder,B,0}' <> '0' or orders #>> '{serviceOrder,B,1}' <> '0'
    or orders #>> '{receiverBySide,A,left}' <> '0' or orders #>> '{receiverBySide,A,right}' <> '0'
    or orders #>> '{receiverBySide,B,left}' <> '0' or orders #>> '{receiverBySide,B,right}' <> '0'
  ) then
    raise exception 'Squash singles orders may only contain player zero.';
  end if;
  if match_format = 'doubles' and (
    orders #>> '{serviceOrder,A,0}' = orders #>> '{serviceOrder,A,1}'
    or orders #>> '{serviceOrder,B,0}' = orders #>> '{serviceOrder,B,1}'
    or orders #>> '{receiverBySide,A,left}' = orders #>> '{receiverBySide,A,right}'
    or orders #>> '{receiverBySide,B,left}' = orders #>> '{receiverBySide,B,right}'
  ) then
    raise exception 'Squash doubles needs two distinct server and receiver players per team.';
  end if;
  if jsonb_typeof(squash_state) is distinct from 'object'
     or jsonb_typeof(squash_state -> 'gameOrders') is distinct from 'object'
     or squash_state ->> 'currentServiceBox' not in ('left', 'right') and squash_state -> 'currentServiceBox' <> 'null'::jsonb
     or squash_state ->> 'serviceRotationStartTeam' not in ('A', 'B')
     or squash_state ->> 'serviceRotationIndex' not in ('0', '1', '2', '3')
     or new.current_state ->> 'sport' is distinct from 'squash'
     or new.current_state ->> 'format' is distinct from match_format then
    raise exception 'Squash score projection is incomplete.';
  end if;
  if coalesce(new.definition ->> 'initialServingTeam', '') not in ('A', 'B')
     or coalesce(new.definition ->> 'initialServingPlayer', '') not in ('0', '1')
     or coalesce(new.current_state ->> 'servingTeam', '') not in ('A', 'B')
     or coalesce(new.current_state ->> 'currentServer', '') not in ('0', '1') then
    raise exception 'Squash server state is invalid.';
  end if;
  if match_format = 'singles' and (new.definition ->> 'initialServingPlayer' <> '0' or new.current_state ->> 'currentServer' <> '0') then
    raise exception 'Squash singles has one player per side.';
  end if;
  return new;
end;
$community_squash_fix$;

notify pgrst, 'reload schema';

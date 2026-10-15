begin;
select plan(17);

select tests.create_supabase_user('all_sports_rule_owner');
select tests.create_supabase_user('all_sports_rule_reader');
select tests.authenticate_as('all_sports_rule_owner');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('all_sports_rule_owner'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);

select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000501', 0, 'badminton',
    'Badminton club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":21,"winBy":2,"maxPoints":30,"bestOf":3,"scoringMode":"rally","serversPerTurn":2,"openingServerNumber":2}}'::jsonb,
    true
  ), 1, 'badminton accepts canonical v2 configuration'
);
select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000502', 0, 'pickleball',
    'Pickleball club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":11,"winBy":2,"maxPoints":null,"bestOf":3,"scoringMode":"side_out","serversPerTurn":2,"openingServerNumber":2}}'::jsonb,
    true
  ), 1, 'pickleball accepts canonical v2 configuration'
);
select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000503', 0, 'tennis',
    'Tennis club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":1,"winBy":1,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"tennis":{"bestOf":3,"gameScoring":"advantage","setScoring":"tiebreak","finalSetScoring":"match_tiebreak","matchTieBreakPoints":10}}'::jsonb,
    true
  ), 1, 'tennis accepts its sport configuration'
);
select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000504', 0, 'padel',
    'Padel club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":1,"winBy":1,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"padel":{"gameScoring":"golden_point","setScoring":"mini","finalSetScoring":"match_tiebreak","matchTieBreakPoints":7}}'::jsonb,
    true
  ), 1, 'padel accepts its sport configuration'
);
select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000505', 0, 'table_tennis',
    'Table tennis club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":11,"winBy":2,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"tableTennis":{"bestOf":5}}'::jsonb,
    true
  ), 1, 'table tennis accepts its sport configuration'
);
select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000506', 0, 'squash',
    'Squash club', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":11,"winBy":2,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"squash":{"bestOf":5}}'::jsonb,
    true
  ), 1, 'squash accepts its sport configuration'
);

select tests.create_supabase_user('all_sports_community_guest');
select tests.authenticate_as('all_sports_community_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('all_sports_community_guest'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);
insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
  last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000507',
  tests.get_supabase_uid('all_sports_community_guest'),
  'tennis',
  '00000000-0000-4000-8000-000000000503',
  'casual',
  '{
    "id":"00000000-0000-4000-8000-000000000507",
    "sport":"tennis",
    "format":"mixed_doubles",
    "rulesetId":"00000000-0000-4000-8000-000000000503",
    "mode":"casual",
    "createdAt":"2026-10-14T00:00:00Z",
    "initialServingTeam":"A",
    "initialServingPlayer":0,
    "tennisSetOrders":{"serviceOrder":{"A":[0,1],"B":[1,0]},"deuceReceiver":{"A":0,"B":1}},
    "tennisLocalRoles":{"A":["woman","man"],"B":["woman","man"]},
    "ruleset":{
      "id":"00000000-0000-4000-8000-000000000503",
      "name":"Tennis club",
      "sport":"tennis",
      "format":"mixed_doubles",
      "source":"community",
      "version":1,
      "configuration":{"pointsToWin":1,"winBy":1,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},
      "tennisConfiguration":{"bestOf":3,"gameScoring":"advantage","setScoring":"tiebreak","finalSetScoring":"match_tiebreak","matchTieBreakPoints":10}
    }
  }'::jsonb,
  'active',
  '{
    "matchId":"00000000-0000-4000-8000-000000000507",
    "sport":"tennis",
    "format":"mixed_doubles",
    "gameNumber":1,
    "gamesWon":{"A":0,"B":0},
    "points":{"A":0,"B":0},
    "servingTeam":"A",
    "currentServer":0,
    "serverNumber":null,
    "positions":{"A":{"left":1,"right":0},"B":{"left":0,"right":1}},
    "status":"active",
    "winner":null,
    "completedGames":[],
    "tennis":{
      "setNumber":1,
      "setsWon":{"A":0,"B":0},
      "gamesInSet":{"A":0,"B":0},
      "pointScore":{"A":0,"B":0},
      "advantage":null,
      "gamePointCount":0,
      "tieBreakScore":null,
      "phase":"game",
      "setOpeningServer":"A",
      "setOrders":{"serviceOrder":{"A":[0,1],"B":[1,0]},"deuceReceiver":{"A":0,"B":1}},
      "serviceTurns":{"A":0,"B":0},
      "tieBreakFirstServer":null,
      "tieBreakStartCourtEndsSwapped":false,
      "noAdReceivingSide":null,
      "awaitingSetOrders":false,
      "courtEndsSwapped":false,
      "completedSets":[]
    }
  }'::jsonb,
  0,
  now(),
  true
);
select ok(
  (select definition ->> 'format' = 'mixed_doubles'
          and definition #>> '{ruleset,source}' = 'community'
          and definition #>> '{ruleset,tennisConfiguration,finalSetScoring}' = 'match_tiebreak'
          and not (definition ? 'tennisLocalRoles')
   from public.matches where id = '00000000-0000-4000-8000-000000000507'),
  'guest matches retain mixed-doubles community rule snapshots without local roles'
);
select ok(
  (select current_state ->> 'format' = 'mixed_doubles'
          and current_state #>> '{tennis,setOrders,deuceReceiver,B}' = '1'
   from public.matches where id = '00000000-0000-4000-8000-000000000507'),
  'guest score projection retains the mixed-doubles format and service order'
);

select tests.authenticate_as('all_sports_rule_reader');
set local role anon;
select is(
  (select count(*)::integer from public.list_community_rules()
   where id between '00000000-0000-4000-8000-000000000501'::uuid
                 and '00000000-0000-4000-8000-000000000506'::uuid),
  6,
  'all six sports are visible through the safe directory RPC'
);
select is(
  (select configuration -> 'tennis' ->> 'finalSetScoring'
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000503', 1)),
  'match_tiebreak',
  'tennis sport configuration is readable through the version RPC'
);
select is(
  (select configuration -> 'padel' ->> 'gameScoring'
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000504', 1)),
  'golden_point',
  'padel sport configuration is readable through the version RPC'
);
select is(
  (select configuration -> 'tableTennis' ->> 'bestOf'
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000505', 1)),
  '5',
  'table tennis sport configuration is readable through the version RPC'
);

reset role;
select tests.authenticate_as('all_sports_rule_reader');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('all_sports_rule_reader'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object('provider', 'google', 'providers', json_build_array('google'))
  )::text,
  true
);
select throws_ok(
  $$select public.save_community_rule(
    '00000000-0000-4000-8000-000000000503', 1, 'tennis', 'Reader edit', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":1,"winBy":1,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"tennis":{"bestOf":3,"gameScoring":"advantage","setScoring":"tiebreak","finalSetScoring":"tiebreak","matchTieBreakPoints":7}}'::jsonb,
    true)$$,
  'P0001',
  'This rule no longer exists.',
  'non-owner cannot edit another creator rule'
);

select tests.authenticate_as('all_sports_rule_owner');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('all_sports_rule_owner'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object('provider', 'google', 'providers', json_build_array('google'))
  )::text,
  true
);
select throws_ok(
  $$select public.save_community_rule(
    '00000000-0000-4000-8000-000000000503', 0, 'tennis', 'Stale tennis', '',
    '{"schemaVersion":2,"scoring":{"pointsToWin":1,"winBy":1,"maxPoints":null,"bestOf":1,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1},"tennis":{"bestOf":3,"gameScoring":"advantage","setScoring":"tiebreak","finalSetScoring":"tiebreak","matchTieBreakPoints":7}}'::jsonb,
    true)$$,
  'P0001',
  'This rule changed elsewhere. Reload it before saving.',
  'stale versions are rejected'
);
select ok(
  public.unpublish_community_rule('00000000-0000-4000-8000-000000000506'),
  'owner can unpublish a sport-specific rule'
);

select tests.authenticate_as('all_sports_rule_reader');
set local role anon;
select is(
  (select count(*)::integer from public.list_community_rules()
   where id = '00000000-0000-4000-8000-000000000506'),
  0,
  'unpublished rules are hidden from anonymous setup reads'
);
select is(
  (select count(*)::integer from public.read_community_rule_version(
    '00000000-0000-4000-8000-000000000506', 1)),
  0,
  'unpublished versions are hidden from anonymous reads'
);

select * from finish();
rollback;

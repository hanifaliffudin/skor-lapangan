begin;
select plan(7);

select tests.create_supabase_user('tennis_guest');
select tests.authenticate_as('tennis_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('tennis_guest'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
  last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000701',
  tests.get_supabase_uid('tennis_guest'),
  'tennis',
  'itf-tennis-2026',
  'casual',
  '{
    "id":"00000000-0000-4000-8000-000000000701",
    "sport":"tennis",
    "format":"mixed_doubles",
    "rulesetId":"itf-tennis-2026",
    "mode":"casual",
    "createdAt":"2026-10-12T00:00:00Z",
    "initialServingTeam":"A",
    "initialServingPlayer":0,
    "tennisSetOrders":{
      "serviceOrder":{"A":[0,1],"B":[1,0]},
      "deuceReceiver":{"A":0,"B":1}
    },
    "tennisLocalRoles":{"A":["woman","man"],"B":["woman","man"]},
    "playerNames":["Private Mixed Player"],
    "ruleset":{
      "id":"itf-tennis-2026",
      "name":"ITF Rules of Tennis 2026",
      "sport":"tennis",
      "format":"mixed_doubles",
      "source":"official",
      "version":1,
      "tennisConfiguration":{
        "bestOf":3,
        "gameScoring":"no_ad",
        "setScoring":"tiebreak",
        "finalSetScoring":"match_tiebreak",
        "matchTieBreakPoints":10
      }
    }
  }'::jsonb,
  'active',
  '{
    "matchId":"00000000-0000-4000-8000-000000000701",
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
    "playerNames":["Private Mixed Player"],
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
      "setOrders":{
        "serviceOrder":{"A":[0,1],"B":[1,0]},
        "deuceReceiver":{"A":0,"B":1}
      },
      "serviceTurns":{"A":0,"B":0},
      "tieBreakFirstServer":null,
      "tieBreakStartCourtEndsSwapped":false,
      "noAdReceivingSide":null,
      "awaitingSetOrders":false,
      "courtEndsSwapped":false,
      "completedSets":[],
      "roleLabels":["woman","man"]
    }
  }'::jsonb,
  0,
  now(),
  true
);

select is(
  (select sport from public.matches where id = '00000000-0000-4000-8000-000000000701'),
  'tennis',
  'Tennis is accepted as a match sport'
);
select ok(
  (select definition ->> 'format' = 'mixed_doubles'
          and not (definition ? 'tennisLocalRoles')
          and not (definition ? 'playerNames')
   from public.matches where id = '00000000-0000-4000-8000-000000000701'),
  'mixed-doubles roles and player names are removed from the stored guest definition'
);
select ok(
  (select definition #>> '{ruleset,tennisConfiguration,finalSetScoring}' = 'match_tiebreak'
          and definition #>> '{ruleset,tennisConfiguration,matchTieBreakPoints}' = '10'
   from public.matches where id = '00000000-0000-4000-8000-000000000701'),
  'the selected ITF tennis rules snapshot is retained'
);
select ok(
  (select current_state #>> '{tennis,setOrders,deuceReceiver,B}' = '1'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'tennis' ? 'roleLabels')
          and not (current_state -> 'tennis' ? 'tennisLocalRoles')
   from public.matches where id = '00000000-0000-4000-8000-000000000701'),
  'the Tennis score projection keeps on-court indexes and excludes names and mixed roles'
);

update public.matches
set last_client_sequence = 1
where id = '00000000-0000-4000-8000-000000000701';

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701',
  tests.get_supabase_uid('tennis_guest'),
  1,
  'tennis_set_orders_confirmed',
  '{"orders":{"serviceOrder":{"A":[1,0],"B":[0,1]},"deuceReceiver":{"A":1,"B":0}},"roleLabels":["woman","man"]}'::jsonb,
  now()
);
select ok(
  (select payload ? 'orders' and not (payload ? 'roleLabels')
          and payload #>> '{orders,deuceReceiver,A}' = '1'
   from public.match_events where id = '00000000-0000-4000-8000-000000000702'),
  'set-order events are projected without mixed-doubles labels'
);

select set_config(
  'test.tennis_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000701'),
  true
);
set local role anon;
select ok(
  (select current_state ->> 'sport' = 'tennis'
          and current_state #>> '{tennis,phase}' = 'game'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'tennis' ? 'roleLabels')
   from public.read_live_viewer(current_setting('test.tennis_viewer_token'))),
  'the Live Viewer receives Tennis score and court state without local labels'
);
reset role;

select throws_ok(
  $$insert into public.matches (
      id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
      last_client_sequence, created_at, is_guest
    ) values (
      '00000000-0000-4000-8000-000000000703',
      tests.get_supabase_uid('tennis_guest'),
      'tennis', 'itf-tennis-2026', 'casual',
      '{"sport":"tennis","format":"singles","ruleset":{"id":"itf-tennis-2026","sport":"tennis","format":"singles","source":"official","version":1,"tennisConfiguration":{"bestOf":4,"gameScoring":"advantage","setScoring":"tiebreak","finalSetScoring":"tiebreak","matchTieBreakPoints":7}}}'::jsonb,
      'active', '{"sport":"tennis","format":"singles","tennis":{"phase":"game","setNumber":1,"setsWon":{"A":0,"B":0},"gamesInSet":{"A":0,"B":0},"pointScore":{"A":0,"B":0},"setOrders":{"serviceOrder":{"A":[0,0],"B":[0,0]}}}}'::jsonb,
      0, now(), true
    )$$,
  'P0001',
  'Tennis scoring format is invalid.',
  'unsupported scoring values are rejected by the Tennis match validator'
);

select * from finish();
rollback;

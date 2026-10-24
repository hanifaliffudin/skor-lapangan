begin;
select plan(7);

select tests.create_supabase_user('table_tennis_guest');
select tests.authenticate_as('table_tennis_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('table_tennis_guest'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
  last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000801',
  tests.get_supabase_uid('table_tennis_guest'),
  'table_tennis',
  'ittf-table-tennis-2022',
  'casual',
  '{
    "id":"00000000-0000-4000-8000-000000000801",
    "sport":"table_tennis",
    "format":"doubles",
    "rulesetId":"ittf-table-tennis-2022",
    "mode":"casual",
    "createdAt":"2026-10-13T00:00:00Z",
    "initialServingTeam":"A",
    "initialServingPlayer":0,
    "tableTennisOrders":{
      "firstServer":{"team":"A","player":0},
      "firstReceiver":{"team":"B","player":1}
    },
    "playerNames":["Private Player"],
    "ruleset":{
      "id":"ittf-table-tennis-2022",
      "name":"ITTF Laws of Table Tennis 2022",
      "sport":"table_tennis",
      "format":"doubles",
      "source":"official",
      "version":1,
      "tableTennisConfiguration":{"bestOf":5}
    }
  }'::jsonb,
  'active',
  '{
    "matchId":"00000000-0000-4000-8000-000000000801",
    "sport":"table_tennis",
    "format":"doubles",
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
    "playerNames":["Private Player"],
    "tableTennis":{
      "gameOrders":{
        "firstServer":{"team":"A","player":0},
        "firstReceiver":{"team":"B","player":1}
      },
      "currentReceiver":1,
      "awaitingGameOrders":false,
      "courtEndsSwapped":false,
      "receivingOrderSwapped":false,
      "private":"remove me"
    }
  }'::jsonb,
  0,
  now(),
  true
);

select is(
  (select sport from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'table_tennis',
  'Table tennis is accepted as a match sport'
);
select ok(
  (select definition ->> 'format' = 'doubles'
          and definition #>> '{tableTennisOrders,firstReceiver,player}' = '1'
          and not (definition ? 'playerNames')
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'guest definition keeps table tennis orders and removes player names'
);
select is(
  (select definition #>> '{ruleset,tableTennisConfiguration,bestOf}'
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  '5',
  'the selected ITTF best-of format is retained'
);
select ok(
  (select current_state #>> '{tableTennis,gameOrders,firstServer,team}' = 'A'
          and current_state #>> '{tableTennis,currentReceiver}' = '1'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'tableTennis' ? 'private')
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'the score projection keeps indexes and excludes local data'
);

update public.matches
set last_client_sequence = 1
where id = '00000000-0000-4000-8000-000000000801';

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000801',
  tests.get_supabase_uid('table_tennis_guest'),
  1,
  'table_tennis_game_orders_confirmed',
  '{"orders":{"firstServer":{"team":"B","player":1},"firstReceiver":{"team":"A","player":0}},"playerNames":["Private Player"]}'::jsonb,
  now()
);
select ok(
  (select payload ? 'orders'
          and not (payload ? 'playerNames')
          and payload #>> '{orders,firstServer,team}' = 'B'
   from public.match_events where id = '00000000-0000-4000-8000-000000000802'),
  'game-order events are sanitized to the public order shape'
);

select set_config(
  'test.table_tennis_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000801'),
  true
);
set local role anon;
select ok(
  (select current_state ->> 'sport' = 'table_tennis'
          and current_state #>> '{tableTennis,gameOrders,firstReceiver,player}' = '1'
          and not (current_state ? 'playerNames')
   from public.read_live_viewer(current_setting('test.table_tennis_viewer_token'))),
  'the Live Viewer receives table tennis state without player names'
);
reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('table_tennis_guest'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);
select throws_ok(
  $$insert into public.matches (
      id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
      last_client_sequence, created_at, is_guest
    ) values (
      '00000000-0000-4000-8000-000000000803',
      tests.get_supabase_uid('table_tennis_guest'),
      'table_tennis', 'ittf-table-tennis-2022', 'casual',
      '{"sport":"table_tennis","format":"singles","initialServingTeam":"A","initialServingPlayer":0,"tableTennisOrders":{"firstServer":{"team":"A","player":0},"firstReceiver":{"team":"B","player":0}},"ruleset":{"id":"ittf-table-tennis-2022","sport":"table_tennis","format":"singles","source":"official","version":1,"tableTennisConfiguration":{"bestOf":4}}}'::jsonb,
      'active', '{"sport":"table_tennis","format":"singles","tableTennis":{"gameOrders":{"firstServer":{"team":"A","player":0},"firstReceiver":{"team":"B","player":0}},"currentReceiver":0}}'::jsonb,
      0, now(), false
    )$$,
  'P0001',
  'Table tennis best-of format is invalid.',
  'unsupported table tennis best-of values are rejected'
);

select * from finish();
rollback;

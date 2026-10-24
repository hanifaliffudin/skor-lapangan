begin;
select plan(7);

select tests.create_supabase_user('squash_guest');
select tests.authenticate_as('squash_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('squash_guest'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
  last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000901',
  tests.get_supabase_uid('squash_guest'),
  'squash',
  'wsf-squash-doubles-2022',
  'casual',
  '{
    "id":"00000000-0000-4000-8000-000000000901",
    "sport":"squash",
    "format":"doubles",
    "rulesetId":"wsf-squash-doubles-2022",
    "mode":"casual",
    "createdAt":"2026-10-13T00:00:00Z",
    "initialServingTeam":"A",
    "initialServingPlayer":0,
    "squashGameOrders":{
      "serviceOrder":{"A":[0,1],"B":[0,1]},
      "receiverBySide":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},
      "openingServiceBox":"right"
    },
    "playerNames":["Private Player"],
    "ruleset":{
      "id":"wsf-squash-doubles-2022",
      "name":"World Squash Doubles Rules 2022",
      "sport":"squash",
      "format":"doubles",
      "source":"official",
      "version":1,
      "squashConfiguration":{"bestOf":5}
    }
  }'::jsonb,
  'active',
  '{
    "matchId":"00000000-0000-4000-8000-000000000901",
    "sport":"squash",
    "format":"doubles",
    "gameNumber":1,
    "gamesWon":{"A":0,"B":0},
    "points":{"A":0,"B":0},
    "servingTeam":"A",
    "currentServer":0,
    "serverNumber":1,
    "positions":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},
    "status":"active",
    "winner":null,
    "completedGames":[],
    "playerNames":["Private Player"],
    "squash":{
      "gameOrders":{
        "serviceOrder":{"A":[0,1],"B":[0,1]},
        "receiverBySide":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},
        "openingServiceBox":"right"
      },
      "currentServiceBox":"right",
      "serviceBoxChoiceRequired":false,
      "awaitingGameOrders":false,
      "serviceRotationStartTeam":"A",
      "serviceRotationIndex":0,
      "private":"remove me"
    }
  }'::jsonb,
  0,
  now(),
  true
);

select is(
  (select sport from public.matches where id = '00000000-0000-4000-8000-000000000901'),
  'squash',
  'Squash is accepted as a match sport'
);
select ok(
  (select definition #>> '{squashGameOrders,openingServiceBox}' = 'right'
          and definition #>> '{ruleset,squashConfiguration,bestOf}' = '5'
          and not (definition ? 'playerNames')
   from public.matches where id = '00000000-0000-4000-8000-000000000901'),
  'guest definition keeps squash order and removes player names'
);
select ok(
  (select current_state #>> '{squash,currentServiceBox}' = 'right'
          and current_state #>> '{squash,serviceRotationIndex}' = '0'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'squash' ? 'private')
   from public.matches where id = '00000000-0000-4000-8000-000000000901'),
  'viewer projection keeps squash state without local data'
);

update public.matches
set last_client_sequence = 1
where id = '00000000-0000-4000-8000-000000000901';

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000901',
  tests.get_supabase_uid('squash_guest'),
  1,
  'squash_service_box_selected',
  '{"side":"left","playerNames":["Private Player"]}'::jsonb,
  now()
);
select ok(
  (select payload ->> 'side' = 'left' and not (payload ? 'playerNames')
   from public.match_events where id = '00000000-0000-4000-8000-000000000902'),
  'service-box event is sanitized'
);

update public.matches
set last_client_sequence = 2
where id = '00000000-0000-4000-8000-000000000901';

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000903',
  '00000000-0000-4000-8000-000000000901',
  tests.get_supabase_uid('squash_guest'),
  2,
  'squash_game_orders_confirmed',
  '{"orders":{"serviceOrder":{"A":[0,1],"B":[0,1]},"receiverBySide":{"A":{"left":0,"right":1},"B":{"left":0,"right":1}},"openingServiceBox":"left"},"playerNames":["Private Player"]}'::jsonb,
  now()
);
select ok(
  (select payload #>> '{orders,receiverBySide,A,left}' = '0'
          and payload #>> '{orders,openingServiceBox}' = 'left'
          and not (payload ? 'playerNames')
   from public.match_events where id = '00000000-0000-4000-8000-000000000903'),
  'game-order event keeps only safe indexes'
);

select set_config(
  'test.squash_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000901'),
  true
);
set local role anon;
select ok(
  (select current_state ->> 'sport' = 'squash'
          and current_state #>> '{squash,gameOrders,serviceOrder,A,0}' = '0'
          and not (current_state ? 'playerNames')
   from public.read_live_viewer(current_setting('test.squash_viewer_token'))),
  'Live Viewer receives squash state without player names'
);
reset role;

select throws_ok(
  $$insert into public.matches (
      id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
      last_client_sequence, created_at, is_guest
    ) values (
      '00000000-0000-4000-8000-000000000904',
      tests.get_supabase_uid('squash_guest'),
      'squash', 'wsf-squash-doubles-2022', 'casual',
      '{"sport":"squash","format":"doubles","initialServingTeam":"A","initialServingPlayer":0,"squashGameOrders":{"serviceOrder":{"A":[0,1],"B":[0,1]},"receiverBySide":{"A":{"left":0,"right":0},"B":{"left":1,"right":0}},"openingServiceBox":"right"},"ruleset":{"id":"wsf-squash-doubles-2022","sport":"squash","format":"doubles","source":"official","version":1,"squashConfiguration":{"bestOf":5}}}'::jsonb,
      'active', '{"sport":"squash","format":"doubles","squash":{"currentServiceBox":"right","serviceBoxChoiceRequired":false,"awaitingGameOrders":false,"serviceRotationStartTeam":"A","serviceRotationIndex":0}}'::jsonb,
      0, now(), false
    )$$,
  'P0001',
  'Squash doubles needs two distinct server and receiver players per team.',
  'invalid squash receiver mappings are rejected'
);

select * from finish();
rollback;

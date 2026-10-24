begin;
select plan(8);

select tests.create_supabase_user('padel_guest');
select tests.authenticate_as('padel_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('padel_guest'),
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
  tests.get_supabase_uid('padel_guest'),
  'padel',
  'fip-padel-2026',
  'casual',
  '{
    "id":"00000000-0000-4000-8000-000000000801",
    "sport":"padel",
    "format":"mixed_doubles",
    "rulesetId":"fip-padel-2026",
    "mode":"casual",
    "createdAt":"2026-10-12T00:00:00Z",
    "initialServingTeam":"A",
    "initialServingPlayer":0,
    "padelSetOrders":{
      "serviceOrder":{"A":[0,1],"B":[1,0]},
      "deuceReceiver":{"A":0,"B":1}
    },
    "padelLocalRoles":{"A":["woman","man"],"B":["man","woman"]},
    "playerNames":["Private Mixed Player"],
    "ruleset":{
      "id":"fip-padel-2026",
      "name":"FIP Rules of Padel 2026",
      "sport":"padel",
      "format":"mixed_doubles",
      "source":"official",
      "version":1,
      "padelConfiguration":{
        "gameScoring":"golden_point",
        "setScoring":"mini",
        "finalSetScoring":"match_tiebreak",
        "matchTieBreakPoints":10
      }
    }
  }'::jsonb,
  'active',
  '{
    "matchId":"00000000-0000-4000-8000-000000000801",
    "sport":"padel",
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
    "padel":{
      "gameScoring":"golden_point",
      "setNumber":1,
      "setsWon":{"A":0,"B":0},
      "gamesInSet":{"A":0,"B":0},
      "pointScore":{"A":3,"B":3},
      "advantage":null,
      "starDeuces":0,
      "gamePointCount":6,
      "tieBreakScore":null,
      "phase":"game",
      "setOpeningServer":"A",
      "setOrders":{"serviceOrder":{"A":[0,1],"B":[1,0]},"deuceReceiver":{"A":0,"B":1}},
      "serviceTurns":{"A":0,"B":0},
      "tieBreakFirstServer":null,
      "tieBreakStartCourtEndsSwapped":false,
      "decidingReceivingSide":"left",
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
  (select sport from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'padel',
  'Padel is accepted as a match sport'
);
select ok(
  (select definition ->> 'format' = 'mixed_doubles'
          and not (definition ? 'padelLocalRoles')
          and not (definition ? 'playerNames')
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'mixed-doubles roles and player names are stripped from the guest definition'
);
select ok(
  (select definition #>> '{ruleset,padelConfiguration,gameScoring}' = 'golden_point'
          and definition #>> '{ruleset,padelConfiguration,setScoring}' = 'mini'
          and definition #>> '{ruleset,padelConfiguration,finalSetScoring}' = 'match_tiebreak'
          and definition #>> '{ruleset,padelConfiguration,matchTieBreakPoints}' = '10'
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'the selected FIP Padel scoring snapshot is retained'
);
select ok(
  (select current_state #>> '{padel,gameScoring}' = 'golden_point'
          and current_state #>> '{padel,setOrders,deuceReceiver,B}' = '1'
          and current_state #>> '{padel,decidingReceivingSide}' = 'left'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'padel' ? 'roleLabels')
          and not (current_state -> 'padel' ? 'padelLocalRoles')
   from public.matches where id = '00000000-0000-4000-8000-000000000801'),
  'the Padel score projection preserves court state without names or role labels'
);

update public.matches
set last_client_sequence = 1
where id = '00000000-0000-4000-8000-000000000801';

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000801',
  tests.get_supabase_uid('padel_guest'),
  1,
  'padel_set_orders_confirmed',
  '{"orders":{"serviceOrder":{"A":[1,0],"B":[0,1]},"deuceReceiver":{"A":1,"B":0}},"roleLabels":["woman","man"]}'::jsonb,
  now()
);
select ok(
  (select payload ? 'orders'
          and not (payload ? 'roleLabels')
          and payload #>> '{orders,deuceReceiver,A}' = '1'
   from public.match_events where id = '00000000-0000-4000-8000-000000000802'),
  'set-order event data excludes mixed-doubles role labels'
);

select set_config(
  'test.padel_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000801'),
  true
);
set local role anon;
select ok(
  (select current_state ->> 'sport' = 'padel'
          and current_state #>> '{padel,phase}' = 'game'
          and current_state #>> '{padel,decidingReceivingSide}' = 'left'
          and not (current_state ? 'playerNames')
          and not (current_state -> 'padel' ? 'roleLabels')
   from public.read_live_viewer(current_setting('test.padel_viewer_token'))),
  'Live Viewer receives Padel score and on-court state without names or local roles'
);
reset role;

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
  last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000803',
  tests.get_supabase_uid('padel_guest'),
  'padel', 'club-padel-singles-2026', 'casual',
  '{"id":"00000000-0000-4000-8000-000000000803","sport":"padel","format":"singles","rulesetId":"club-padel-singles-2026","mode":"casual","createdAt":"2026-10-12T00:00:00Z","initialServingTeam":"A","initialServingPlayer":0,"padelSetOrders":{"serviceOrder":{"A":[0,0],"B":[0,0]},"deuceReceiver":{"A":0,"B":0}},"ruleset":{"id":"club-padel-singles-2026","sport":"padel","format":"singles","source":"local_variant","version":1,"padelConfiguration":{"gameScoring":"advantage","setScoring":"standard","finalSetScoring":"standard","matchTieBreakPoints":7}}}'::jsonb,
  'active',
  '{"matchId":"00000000-0000-4000-8000-000000000803","sport":"padel","format":"singles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":0,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":0},"B":{"left":0,"right":0}},"status":"active","winner":null,"completedGames":[],"padel":{"gameScoring":"advantage","setNumber":1,"setsWon":{"A":0,"B":0},"gamesInSet":{"A":0,"B":0},"pointScore":{"A":0,"B":0},"advantage":null,"starDeuces":0,"gamePointCount":0,"tieBreakScore":null,"phase":"game","setOpeningServer":"A","setOrders":{"serviceOrder":{"A":[0,0],"B":[0,0]},"deuceReceiver":{"A":0,"B":0}},"serviceTurns":{"A":0,"B":0},"tieBreakFirstServer":null,"tieBreakStartCourtEndsSwapped":false,"decidingReceivingSide":null,"awaitingSetOrders":false,"courtEndsSwapped":false,"completedSets":[]}}'::jsonb,
  0, now(), true
);
select ok(
  (select definition #>> '{ruleset,source}' = 'local_variant'
          and definition #>> '{ruleset,id}' = 'club-padel-singles-2026'
   from public.matches where id = '00000000-0000-4000-8000-000000000803'),
  'club singles stores its non-FIP variant snapshot'
);

select throws_ok(
  $$insert into public.matches (
      id, owner_id, sport, ruleset_id, mode, definition, status, current_state,
      last_client_sequence, created_at, is_guest
    ) values (
      '00000000-0000-4000-8000-000000000804',
      tests.get_supabase_uid('padel_guest'),
      'padel', 'fip-padel-2026', 'casual',
      '{"sport":"padel","format":"doubles","ruleset":{"id":"fip-padel-2026","sport":"padel","format":"doubles","source":"official","version":1,"padelConfiguration":{"gameScoring":"mystery","setScoring":"standard","finalSetScoring":"standard","matchTieBreakPoints":7}}}'::jsonb,
      'active', '{"sport":"padel","format":"doubles","padel":{"phase":"game","setNumber":1,"setsWon":{"A":0,"B":0},"gamesInSet":{"A":0,"B":0},"pointScore":{"A":0,"B":0},"setOrders":{"serviceOrder":{"A":[0,1],"B":[0,1]}}}}'::jsonb,
      0, now(), true
    )$$,
  'P0001',
  'Padel scoring format is invalid.',
  'unsupported Padel scoring values are rejected'
);

select * from finish();
rollback;

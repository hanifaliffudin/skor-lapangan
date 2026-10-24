begin;
select plan(10);

select tests.create_supabase_user('sync_owner');
select tests.authenticate_as('sync_owner');

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":0,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 0,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[]'::jsonb
  ),
  'applied',
  'the first journal snapshot is applied'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":1,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 1,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000952","client_sequence":1,"event_type":"rally_awarded","payload":{"team":"A"},"created_at":"2026-10-13T00:00:01.000Z"}]'::jsonb
  ),
  'applied',
  'the next snapshot and event are applied together'
);

select is(
  (select last_client_sequence from public.matches where id = '00000000-0000-4000-8000-000000000951'),
  1::bigint,
  'the match stores the applied client sequence'
);
select is(
  (select count(*)::integer from public.match_events where match_id = '00000000-0000-4000-8000-000000000951'),
  1,
  'the event is stored once'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":1,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 1,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000952","client_sequence":1,"event_type":"rally_awarded","payload":{"team":"A"},"created_at":"2026-10-13T00:00:01.000Z"}]'::jsonb
  ),
  'already_synced',
  'replaying the same snapshot is idempotent'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":2,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 0,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[]'::jsonb
  ),
  'stale',
  'an older client sequence cannot overwrite a newer snapshot'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":9,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 1,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[]'::jsonb
  ),
  'conflict',
  'the same sequence with a different state is rejected as a conflict'
);

select throws_ok(
  $$select public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000951',
    p_owner_id => tests.get_supabase_uid('sync_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-13T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"ruleset":{"source":"official"}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000951","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":2,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 2,
    p_created_at => '2026-10-13T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'sync-control-token-951',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000953","client_sequence":2,"event_type":"unsupported_event","payload":{},"created_at":"2026-10-13T00:00:02.000Z"}]'::jsonb
  )$$,
  '23514',
  'new row for relation "match_events" violates check constraint "match_events_event_type_check"',
  'an invalid event rolls back the snapshot update'
);

select is(
  (select last_client_sequence from public.matches where id = '00000000-0000-4000-8000-000000000951'),
  1::bigint,
  'the failed transaction leaves the previous snapshot intact'
);
select is(
  (select count(*)::integer from public.match_events where match_id = '00000000-0000-4000-8000-000000000951'),
  1,
  'the failed transaction leaves the previous events intact'
);

select * from finish();
rollback;

begin;
select plan(17);

select tests.create_supabase_user('cross_device_owner');
select tests.authenticate_as('cross_device_owner');

select is(
  public.acquire_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-1',
    false
  ),
  'not_found',
  'a new local match can bootstrap before its first sync'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000961',
    p_owner_id => tests.get_supabase_uid('cross_device_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-14T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"teams":{"A":{"name":"Team A","players":[{"id":"a1","name":"A1"},{"id":"a2","name":"A2"}]},"B":{"name":"Team B","players":[{"id":"b1","name":"B1"},{"id":"b2","name":"B2"}]}}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":0,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":1,"right":0},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 0,
    p_created_at => '2026-10-14T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'cross-device-control-token-1',
    p_events => '[]'::jsonb
  ),
  'applied',
  'the first account journal creates its control lease'
);

select is(
  public.acquire_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-1',
    false
  ),
  'acquired',
  'the current device can reacquire its own control lease'
);

select is(
  public.acquire_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-2',
    false
  ),
  'held',
  'a second device cannot take active control silently'
);

select is(
  public.renew_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-1'
  ),
  true,
  'the active device can renew its lease'
);

select is(
  public.acquire_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-2',
    true
  ),
  'acquired',
  'an explicit takeover replaces the current lease'
);

select is(
  public.renew_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-1'
  ),
  false,
  'the old device cannot renew after takeover'
);

select is(
  public.renew_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-control-token-2'
  ),
  true,
  'the takeover device can renew the new lease'
);

select throws_ok(
  $$select public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000961',
    p_owner_id => tests.get_supabase_uid('cross_device_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{}'::jsonb,
    p_last_client_sequence => 0,
    p_created_at => '2026-10-14T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'cross-device-control-token-1',
    p_events => '[]'::jsonb
  )$$,
  '42501',
  'the old device cannot sync after takeover'
);

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000961',
    p_owner_id => tests.get_supabase_uid('cross_device_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-14T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"teams":{"A":{"name":"Team A","players":[{"id":"a1","name":"A1"},{"id":"a2","name":"A2"}]},"B":{"name":"Team B","players":[{"id":"b1","name":"B1"},{"id":"b2","name":"B2"}]}}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":1,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 1,
    p_created_at => '2026-10-14T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'cross-device-control-token-2',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000962","client_sequence":1,"event_type":"rally_awarded","payload":{"team":"A"},"created_at":"2026-10-14T00:00:01.000Z"}]'::jsonb
  ),
  'applied',
  'the active takeover device can sync'
);

select is(
  (select count(*)::integer
   from public.read_match_journal('00000000-0000-4000-8000-000000000961')),
  1,
  'the owner can read one remote journal row'
);

select is(
  (select jsonb_array_length(events)
   from public.read_match_journal('00000000-0000-4000-8000-000000000961')),
  1,
  'the reader returns the ordered event journal'
);

select tests.create_supabase_user('cross_device_other');
select tests.authenticate_as('cross_device_other');

select is(
  (select count(*)::integer
   from public.read_match_journal('00000000-0000-4000-8000-000000000961')),
  0,
  'another account cannot read the owner journal'
);

select is(
  public.acquire_match_control(
    '00000000-0000-4000-8000-000000000961',
    'cross-device-other-token-1',
    true
  ),
  'not_found',
  'another account cannot acquire the owner control lease'
);

select tests.authenticate_as('cross_device_owner');

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000961',
    p_owner_id => tests.get_supabase_uid('cross_device_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-14T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"teams":{"A":{"name":"Team A","players":[{"id":"a1","name":"A1"},{"id":"a2","name":"A2"}]},"B":{"name":"Team B","players":[{"id":"b1","name":"B1"},{"id":"b2","name":"B2"}]}}}'::jsonb,
    p_status => 'complete',
    p_winner => 'A',
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000961","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":1,"B":0},"points":{"A":21,"B":10},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"complete","winner":"A","completedGames":[]}'::jsonb,
    p_last_client_sequence => 2,
    p_created_at => '2026-10-14T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'cross-device-control-token-2',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000963","client_sequence":2,"event_type":"rally_awarded","payload":{"team":"A"},"created_at":"2026-10-14T00:00:02.000Z"}]'::jsonb
  ),
  'applied',
  'a complete match remains readable without a control lease'
);

select is(
  (select status
   from public.read_match_journal('00000000-0000-4000-8000-000000000961')),
  'complete',
  'a completed match remains readable after the lease is cleared'
);

select is(
  (select control_token_hash is null
   from public.matches
   where id = '00000000-0000-4000-8000-000000000961'),
  true,
  'completing a match clears its control lease'
);

select * from finish();
rollback;

begin;
select plan(5);

select tests.create_supabase_user('event_integrity_owner');
select tests.authenticate_as('event_integrity_owner');

select is(
  public.sync_match_journal(
    p_match_id => '00000000-0000-4000-8000-000000000971',
    p_owner_id => tests.get_supabase_uid('event_integrity_owner'),
    p_sport => 'badminton',
    p_ruleset_id => 'bwf-doubles-3x21-2025',
    p_mode => 'casual',
    p_definition => '{"id":"00000000-0000-4000-8000-000000000971","sport":"badminton","format":"doubles","rulesetId":"bwf-doubles-3x21-2025","mode":"casual","createdAt":"2026-10-15T00:00:00.000Z","initialServingTeam":"A","initialServingPlayer":0,"teams":{"A":{"name":"Team A","players":[{"id":"a1","name":"A1"},{"id":"a2","name":"A2"}]},"B":{"name":"Team B","players":[{"id":"b1","name":"B1"},{"id":"b2","name":"B2"}]}}}'::jsonb,
    p_status => 'active',
    p_winner => null,
    p_current_state => '{"matchId":"00000000-0000-4000-8000-000000000971","sport":"badminton","format":"doubles","gameNumber":1,"gamesWon":{"A":0,"B":0},"points":{"A":1,"B":0},"servingTeam":"A","currentServer":0,"serverNumber":null,"positions":{"A":{"left":0,"right":1},"B":{"left":1,"right":0}},"status":"active","winner":null,"completedGames":[]}'::jsonb,
    p_last_client_sequence => 1,
    p_created_at => '2026-10-15T00:00:00.000Z'::timestamptz,
    p_is_guest => false,
    p_control_token => 'event-integrity-control-token',
    p_events => '[{"id":"00000000-0000-4000-8000-000000000972","client_sequence":1,"event_type":"rally_awarded","payload":{"team":"A"},"created_at":"2026-10-15T00:00:01.000Z"}]'::jsonb
  ),
  'applied',
  'a valid event journal is accepted'
);

select lives_ok(
  $$insert into public.match_events (
    id, match_id, owner_id, client_sequence, event_type, payload, created_at
  ) values (
    '00000000-0000-4000-8000-000000000972',
    '00000000-0000-4000-8000-000000000971',
    tests.get_supabase_uid('event_integrity_owner'),
    1,
    'rally_awarded',
    '{"team":"A"}'::jsonb,
    '2026-10-15T00:00:01.000Z'::timestamptz
  ) on conflict (id) do nothing$$,
  'an identical retry remains idempotent'
);

select throws_ok(
  $$insert into public.match_events (
    id, match_id, owner_id, client_sequence, event_type, payload, created_at
  ) values (
    '00000000-0000-4000-8000-000000000972',
    '00000000-0000-4000-8000-000000000971',
    tests.get_supabase_uid('event_integrity_owner'),
    1,
    'rally_awarded',
    '{"team":"B"}'::jsonb,
    '2026-10-15T00:00:02.000Z'::timestamptz
  )$$,
  '23514',
  'an event ID cannot be reused with different data'
);

select throws_ok(
  $$insert into public.match_events (
    id, match_id, owner_id, client_sequence, event_type, payload, created_at
  ) values (
    '00000000-0000-4000-8000-000000000973',
    '00000000-0000-4000-8000-000000000971',
    tests.get_supabase_uid('event_integrity_owner'),
    1,
    'rally_awarded',
    '{"team":"A"}'::jsonb,
    '2026-10-15T00:00:03.000Z'::timestamptz
  )$$,
  '23514',
  'a sequence cannot be reused with a different event ID'
);

select throws_ok(
  $$insert into public.match_events (
    id, match_id, owner_id, client_sequence, event_type, payload, created_at
  ) values (
    '00000000-0000-4000-8000-000000000974',
    '00000000-0000-4000-8000-000000000971',
    tests.get_supabase_uid('event_integrity_owner'),
    2,
    'rally_awarded',
    '{"team":"A"}'::jsonb,
    '2026-10-15T00:00:04.000Z'::timestamptz
  )$$,
  '23514',
  'an event cannot exceed the match snapshot sequence'
);

select * from finish();
rollback;

begin;
select plan(16);

select ok(
  private.take_rate_limit('release-guardrail-test', 'guest_match_create', 2, 3600),
  'the first request in a rate-limit window is allowed'
);
select ok(
  private.take_rate_limit('release-guardrail-test', 'guest_match_create', 2, 3600),
  'requests below the configured limit are allowed'
);
select ok(
  not private.take_rate_limit('release-guardrail-test', 'guest_match_create', 2, 3600),
  'requests above the configured limit are rejected'
);
select is(
  (select request_count
   from private.action_rate_limits
   where actor_key = 'release-guardrail-test'
     and action = 'guest_match_create'),
  3,
  'the counter is capped at the first rejected request'
);

select tests.create_supabase_user('guardrail_guest');
select tests.authenticate_as('guardrail_guest');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('guardrail_guest'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status,
  current_state, last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000401',
  tests.get_supabase_uid('guardrail_guest'),
  'badminton',
  'bwf-doubles-3x21-2025',
  'casual',
  '{"id":"00000000-0000-4000-8000-000000000401","playerNames":["private"]}'::jsonb,
  'active',
  '{"matchId":"00000000-0000-4000-8000-000000000401","points":{"A":0,"B":0}}'::jsonb,
  0,
  now(),
  false
);

select ok(
  (select is_guest from public.matches
   where id = '00000000-0000-4000-8000-000000000401'),
  'an anonymous client cannot opt out of guest retention'
);
select ok(
  (select not (definition ? 'playerNames') from public.matches
   where id = '00000000-0000-4000-8000-000000000401'),
  'guest payload sanitization runs after guest classification'
);
select ok(
  (select expires_at > now() + interval '11 hours'
          and expires_at <= now() + interval '12 hours'
   from public.matches where id = '00000000-0000-4000-8000-000000000401'),
  'guest server data expires after twelve hours of inactivity'
);
select ok(
  (select hard_expires_at > now() + interval '23 hours'
          and hard_expires_at <= now() + interval '24 hours'
   from public.matches where id = '00000000-0000-4000-8000-000000000401'),
  'guest retention has a hard twenty-four-hour cap'
);
select set_config(
  'test.guardrail_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000401'),
  true
);
select ok(
  (select viewer_expires_at <= now() + interval '12 hours'
          and viewer_expires_at <= expires_at
   from public.matches where id = '00000000-0000-4000-8000-000000000401'),
  'a viewer link expires within twelve hours and no later than its match'
);

select tests.create_supabase_user('guardrail_rule_owner');
select tests.authenticate_as('guardrail_rule_owner');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('guardrail_rule_owner'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);
select public.save_community_rule(
  '00000000-0000-4000-8000-000000000402',
  0,
  'badminton',
  'Guardrail test rule',
  'A published rule used by the database regression test.',
  '{"pointsToWin":21,"winBy":2,"maxPoints":30,"bestOf":3,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1}'::jsonb,
  true
);

select tests.create_supabase_user('guardrail_reporter');
select tests.authenticate_as('guardrail_reporter');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('guardrail_reporter'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);
select set_config(
  'test.guardrail_report_id',
  public.report_community_rule_v2(
    '00000000-0000-4000-8000-000000000402',
    'rights',
    'Please check the attribution.',
    'reporter@example.test'
  )::text,
  true
);
select is(
  (select status || ':' || reason || ':' || reporter_contact
   from public.community_rule_reports
   where id = current_setting('test.guardrail_report_id')::uuid),
  'open:rights:reporter@example.test',
  'guest reports include a moderation state, reason, and optional contact'
);
select lives_ok(
  $$select public.report_community_rule_v2(
      '00000000-0000-4000-8000-000000000402', 'incorrect', '', null)$$,
  'a second report in the hourly window is allowed'
);
select lives_ok(
  $$select public.report_community_rule_v2(
      '00000000-0000-4000-8000-000000000402', 'misleading', '', null)$$,
  'a third report in the hourly window is allowed'
);
select throws_ok(
  $$select public.report_community_rule_v2(
      '00000000-0000-4000-8000-000000000402', 'unsafe', '', null)$$,
  'P0001',
  'RATE_LIMIT: community_rule_report',
  'a fourth report in the hourly window is rejected'
);
update public.community_rule_reports
set status = 'actioned',
    resolution = 'removed',
    reviewed_at = now(),
    review_notes = 'Rule removed during the retention regression test.'
where id = current_setting('test.guardrail_report_id')::uuid;
delete from public.community_rules
where id = '00000000-0000-4000-8000-000000000402';
select is(
  (select status || ':' || resolution
   from public.community_rule_reports
   where id = current_setting('test.guardrail_report_id')::uuid),
  'actioned:removed',
  'moderation history survives permanent rule removal'
);
select ok(
  (select rule_id is null from public.community_rule_reports
   where id = current_setting('test.guardrail_report_id')::uuid),
  'the retained report no longer references the deleted rule'
);
select is(
  (select count(*)::integer
   from cron.job where jobname = 'purge-expired-guest-data'),
  1,
  'the hourly guest-data cleanup job is installed once'
);

select * from finish();
rollback;

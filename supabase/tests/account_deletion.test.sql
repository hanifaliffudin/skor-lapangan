begin;
select plan(12);

select tests.create_supabase_user('account_delete_owner');
select tests.create_supabase_user('account_delete_other');

select tests.authenticate_as('account_delete_other');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('account_delete_other'),
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
  '00000000-0000-4000-8000-000000000503',
  0,
  'badminton',
  'Other account rule',
  'A rule that must survive another account deletion.',
  '{"schemaVersion":2,"scoring":{"pointsToWin":21,"winBy":2,"maxPoints":30,"bestOf":3,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1}}'::jsonb,
  true
);

select tests.authenticate_as('account_delete_owner');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('account_delete_owner'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);

insert into public.matches (
  id, owner_id, sport, ruleset_id, mode, definition, status,
  current_state, last_client_sequence, created_at, is_guest
) values (
  '00000000-0000-4000-8000-000000000501',
  tests.get_supabase_uid('account_delete_owner'),
  'badminton',
  'bwf-doubles-3x21-2025',
  'casual',
  '{"id":"00000000-0000-4000-8000-000000000501","ruleset":{"source":"official"}}'::jsonb,
  'active',
  '{"matchId":"00000000-0000-4000-8000-000000000501","points":{"A":0,"B":0}}'::jsonb,
  1,
  now(),
  false
);

insert into public.match_events (
  id, match_id, owner_id, client_sequence, event_type, payload, created_at
) values (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000501',
  tests.get_supabase_uid('account_delete_owner'),
  1,
  'rally_awarded',
  '{"team":"A"}'::jsonb,
  now()
);

select set_config(
  'test.account_delete_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000501'),
  true
);

select public.save_community_rule(
  '00000000-0000-4000-8000-000000000504',
  0,
  'badminton',
  'Owner account rule',
  'A rule that belongs to the account being deleted.',
  '{"schemaVersion":2,"scoring":{"pointsToWin":21,"winBy":2,"maxPoints":30,"bestOf":3,"scoringMode":"rally","serversPerTurn":1,"openingServerNumber":1}}'::jsonb,
  true
);

select public.report_community_rule(
  '00000000-0000-4000-8000-000000000503',
  'other',
  'A report owned by the account being deleted.'
);

set local role service_role;
select is(
  (select count(*)::integer from public.matches
   where owner_id = tests.get_supabase_uid('account_delete_owner')),
  1,
  'the account owns a match before deletion'
);
select is(
  (select count(*)::integer from public.match_events
   where owner_id = tests.get_supabase_uid('account_delete_owner')),
  1,
  'the account owns an event before deletion'
);
select is(
  (select count(*)::integer from public.community_rules
   where author_id = tests.get_supabase_uid('account_delete_owner')),
  1,
  'the account owns a community rule before deletion'
);
select is(
  (select count(*)::integer from public.community_rule_versions
   where created_by = tests.get_supabase_uid('account_delete_owner')),
  1,
  'the account owns a rule version before deletion'
);
select is(
  (select count(*)::integer from public.community_rule_reports
   where reporter_id = tests.get_supabase_uid('account_delete_owner')),
  1,
  'the account owns a report before deletion'
);

reset role;

select public.delete_my_account_data();

set local role service_role;
select is(
  (select count(*)::integer from public.matches
   where owner_id = tests.get_supabase_uid('account_delete_owner')),
  0,
  'account deletion removes the owned match and its viewer capability'
);
reset role;
select is(
  (select count(*)::integer
   from public.read_live_viewer(current_setting('test.account_delete_viewer_token'))),
  0,
  'a viewer token cannot read a match after account deletion'
);
set local role service_role;
select is(
  (select count(*)::integer from public.match_events
   where owner_id = tests.get_supabase_uid('account_delete_owner')),
  0,
  'account deletion removes owned match events'
);
select is(
  (select count(*)::integer from public.community_rules
   where author_id = tests.get_supabase_uid('account_delete_owner')),
  0,
  'account deletion removes owned community rules'
);
select is(
  (select count(*)::integer from public.community_rule_versions
   where created_by = tests.get_supabase_uid('account_delete_owner')),
  0,
  'account deletion removes owned rule versions'
);
select is(
  (select count(*)::integer from public.community_rule_reports
   where reporter_id = tests.get_supabase_uid('account_delete_owner')),
  0,
  'account deletion removes owned reports'
);
select is(
  (select count(*)::integer from public.community_rules
   where id = '00000000-0000-4000-8000-000000000503'),
  1,
  'account deletion does not remove another account community rule'
);

reset role;
select * from finish();
rollback;

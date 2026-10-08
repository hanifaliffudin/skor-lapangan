begin;
select plan(6);

select tests.rls_enabled('public', 'matches');
select tests.rls_enabled('public', 'match_events');

select tests.create_supabase_user('owner');
select tests.create_supabase_user('stranger');

select tests.authenticate_as('owner');
insert into public.matches (
  id,
  owner_id,
  sport,
  ruleset_id,
  mode,
  definition,
  status,
  current_state,
  created_at
) values (
  '00000000-0000-4000-8000-000000000001',
  tests.get_supabase_uid('owner'),
  'badminton',
  'bwf-doubles-3x21-2025',
  'casual',
  '{}'::jsonb,
  'active',
  '{}'::jsonb,
  now()
);

select is(
  (select count(*)::integer from public.matches),
  1,
  'owner can read their match'
);

insert into public.match_events (
  id,
  match_id,
  owner_id,
  client_sequence,
  event_type,
  payload,
  created_at
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  tests.get_supabase_uid('owner'),
  1,
  'rally_awarded',
  '{"team":"A"}'::jsonb,
  now()
);

select is(
  (select count(*)::integer from public.match_events),
  1,
  'owner can read their match event'
);

select tests.authenticate_as('stranger');
select is(
  (select count(*)::integer from public.matches),
  0,
  'another user cannot read the owner match'
);

select is(
  (select count(*)::integer from public.match_events),
  0,
  'another user cannot read the owner event'
);

select * from finish();
rollback;

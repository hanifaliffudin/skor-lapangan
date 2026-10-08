begin;
select plan(4);

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

select tests.authenticate_as('stranger');
select is(
  (select count(*)::integer from public.matches),
  0,
  'another user cannot read the owner match'
);

select * from finish();
rollback;

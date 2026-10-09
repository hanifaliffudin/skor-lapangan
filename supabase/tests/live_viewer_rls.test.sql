begin;
select plan(5);

select tests.create_supabase_user('guest_owner');
select tests.authenticate_as('guest_owner');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('guest_owner'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);

insert into public.matches (
  id,
  owner_id,
  sport,
  ruleset_id,
  mode,
  definition,
  status,
  current_state,
  created_at,
  is_guest
) values (
  '00000000-0000-4000-8000-000000000101',
  tests.get_supabase_uid('guest_owner'),
  'badminton',
  'bwf-doubles-3x21-2025',
  'casual',
  '{"sport":"badminton"}'::jsonb,
  'active',
  '{"points":{"A":0,"B":0}}'::jsonb,
  now(),
  true
);

select ok(
  (select expires_at > now() + interval '11 hours' and expires_at <= now() + interval '12 hours'
   from public.matches where id = '00000000-0000-4000-8000-000000000101'),
  'guest match receives a twelve-hour server expiry'
);

select set_config(
  'test.live_viewer_token',
  public.create_live_viewer_link('00000000-0000-4000-8000-000000000101'),
  true
);

set local role anon;
select ok(
  not has_table_privilege('anon', 'public.matches', 'select'),
  'unauthenticated visitors have no direct match-table select grant'
);
select is(
  (select count(*)::integer from public.read_live_viewer(current_setting('test.live_viewer_token'))),
  1,
  'a valid live viewer capability returns a read-only state'
);
reset role;

select tests.authenticate_as('guest_owner');
select public.revoke_live_viewer_link('00000000-0000-4000-8000-000000000101');
set local role anon;
select is(
  (select count(*)::integer from public.read_live_viewer(current_setting('test.live_viewer_token'))),
  0,
  'revoked viewer capability returns no match state'
);
reset role;

select is(
  (select count(*)::integer from public.read_live_viewer('not-a-real-token')),
  0,
  'unknown viewer capability returns no match state'
);

select * from finish();
rollback;

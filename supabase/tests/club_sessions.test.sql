begin;
select plan(16);

select tests.rls_enabled('public', 'club_sessions');
select tests.rls_enabled('public', 'club_session_players');
select tests.rls_enabled('public', 'club_session_courts');
select tests.rls_enabled('public', 'club_session_matches');

select tests.create_supabase_user('club_owner');
select tests.create_supabase_user('club_other');
select tests.authenticate_as('club_owner');

insert into public.club_sessions (id, owner_id, name, session_date)
values (
  '00000000-0000-4000-8000-000000001001',
  tests.get_supabase_uid('club_owner'),
  'Saturday doubles',
  '2026-10-19'
);

insert into public.club_session_players
  (id, session_id, owner_id, display_name, sort_order)
values
  ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'), 'One', 0),
  ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'), 'Two', 1),
  ('00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'), 'Three', 2),
  ('00000000-0000-4000-8000-000000001014', '00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'), 'Four', 3);

insert into public.club_session_courts
  (id, session_id, owner_id, name, sort_order)
values (
  '00000000-0000-4000-8000-000000001021',
  '00000000-0000-4000-8000-000000001001',
  tests.get_supabase_uid('club_owner'),
  'Court 1',
  0
);

insert into public.club_session_matches (
  id,
  session_id,
  owner_id,
  match_id,
  court_id,
  team_a_player_1,
  team_a_player_2,
  team_b_player_1,
  team_b_player_2,
  queue_order
) values (
  '00000000-0000-4000-8000-000000001031',
  '00000000-0000-4000-8000-000000001001',
  tests.get_supabase_uid('club_owner'),
  '00000000-0000-4000-8000-000000001041',
  '00000000-0000-4000-8000-000000001021',
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001012',
  '00000000-0000-4000-8000-000000001013',
  '00000000-0000-4000-8000-000000001014',
  0
);

select is(
  (select count(*)::integer from public.club_sessions),
  1,
  'the owner can read their session'
);
select is(
  (select count(*)::integer from public.club_session_players),
  4,
  'the owner can read the session roster'
);
select is(
  (select count(*)::integer from public.club_session_courts),
  1,
  'the owner can read the session courts'
);
select is(
  (select count(*)::integer from public.club_session_matches),
  1,
  'the owner can read the match queue'
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
  created_at
) values (
  '00000000-0000-4000-8000-000000001041',
  tests.get_supabase_uid('club_owner'),
  'badminton',
  'bwf-doubles-3x21-2025',
  'casual',
  '{"id":"00000000-0000-4000-8000-000000001041"}'::jsonb,
  'active',
  '{"matchId":"00000000-0000-4000-8000-000000001041","status":"active"}'::jsonb,
  now()
);

select is(
  (select linked_match_id
   from public.club_session_matches
   where match_id = '00000000-0000-4000-8000-000000001041'),
  '00000000-0000-4000-8000-000000001041'::uuid,
  'the planned queue entry links when its account match is created'
);

select tests.authenticate_as('club_other');
select is(
  (select count(*)::integer from public.club_sessions),
  0,
  'another account cannot read the owner session'
);
select is(
  (select count(*)::integer from public.club_session_players),
  0,
  'another account cannot read the owner roster'
);
select is(
  (select count(*)::integer from public.club_session_courts),
  0,
  'another account cannot read the owner courts'
);
select is(
  (select count(*)::integer from public.club_session_matches),
  0,
  'another account cannot read the owner queue'
);

select tests.authenticate_as('club_owner');
delete from public.club_sessions
where id = '00000000-0000-4000-8000-000000001001';

select is(
  (select count(*)::integer from public.club_session_players),
  0,
  'deleting a session removes its roster'
);
select is(
  (select count(*)::integer from public.club_session_matches),
  0,
  'deleting a session removes its queue without deleting the match journal'
);
select is(
  (select count(*)::integer
   from public.matches
   where id = '00000000-0000-4000-8000-000000001041'),
  1,
  'deleting a session leaves the account match journal intact'
);

select * from finish();
rollback;

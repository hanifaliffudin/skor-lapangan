begin;
select plan(31);

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

select is(
  (select pairing_mode from public.club_sessions limit 1),
  'open',
  'new sessions default to open pairing'
);
insert into public.club_sessions (id, owner_id, name, session_date, sport)
values (
  '00000000-0000-4000-8000-000000001002',
  tests.get_supabase_uid('club_owner'),
  'Sunday pickleball',
  '2026-10-20',
  'pickleball'
);
select is(
  (select sport from public.club_sessions
   where id = '00000000-0000-4000-8000-000000001002'),
  'pickleball',
  'pickleball is supported for club sessions'
);
insert into public.club_sessions (id, owner_id, name, session_date, sport)
values
  ('00000000-0000-4000-8000-000000001003', tests.get_supabase_uid('club_owner'), 'Tuesday tennis', '2026-10-21', 'tennis'),
  ('00000000-0000-4000-8000-000000001004', tests.get_supabase_uid('club_owner'), 'Wednesday padel', '2026-10-22', 'padel'),
  ('00000000-0000-4000-8000-000000001005', tests.get_supabase_uid('club_owner'), 'Thursday table tennis', '2026-10-23', 'table_tennis'),
  ('00000000-0000-4000-8000-000000001006', tests.get_supabase_uid('club_owner'), 'Friday squash', '2026-10-24', 'squash');
select is(
  (select array_agg(sport order by sport) from public.club_sessions),
  ARRAY['badminton', 'padel', 'pickleball', 'squash', 'table_tennis', 'tennis']::text[],
  'all supported sports are available for club sessions'
);
select is(
  (select play_profile from public.club_sessions
   where sport = 'table_tennis'),
  'table_tennis_singles_short',
  'table tennis sessions default to the short singles profile'
);
select is(
  (select format from public.club_sessions
   where sport = 'squash'),
  'singles',
  'squash sessions default to singles format'
);
select throws_ok(
  $$insert into public.club_sessions (owner_id, name, session_date, sport)
    values (tests.get_supabase_uid('club_owner'), 'Hockey session', '2026-10-25', 'hockey')$$,
  '23514'::char(5),
  null,
  'club sessions reject sports outside the supported sport profiles'
);
select is(
  (select gender from public.club_session_players order by sort_order limit 1),
  null,
  'new players leave gender unspecified'
);
select is(
  (select skill_level from public.club_session_players order by sort_order limit 1),
  3::smallint,
  'new players default to skill level three'
);
select is(
  (select availability from public.club_session_players order by sort_order limit 1),
  'available',
  'new players default to available'
);
select is(
  (select avoid_player_ids from public.club_session_players order by sort_order limit 1),
  '{}'::uuid[],
  'new players default to no avoid preferences'
);
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
  (select is_open_fallback from public.club_session_matches limit 1),
  false,
  'queue entries default to non-fallback doubles'
);

select throws_ok(
  $$insert into public.club_sessions
      (owner_id, name, session_date, sport, time_zone)
    values
      (tests.get_supabase_uid('club_owner'), 'Invalid timezone', '2026-10-25', 'badminton', 'Mars/Olympus')$$,
  '23514'::char(5),
  null,
  'club sessions reject non-IANA time zones'
);

insert into public.club_session_players
  (id, session_id, owner_id, display_name, sort_order, is_active)
values (
  '00000000-0000-4000-8000-000000001015',
  '00000000-0000-4000-8000-000000001001',
  tests.get_supabase_uid('club_owner'),
  'Inactive',
  4,
  false
);

select throws_ok(
  $$insert into public.club_session_matches
      (session_id, owner_id, match_id, court_id,
       team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
       queue_order)
    values
      ('00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'),
       '00000000-0000-4000-8000-000000001051', '00000000-0000-4000-8000-000000001021',
       '00000000-0000-4000-8000-000000001015', '00000000-0000-4000-8000-000000001012',
       '00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001014',
       1)$$,
  'P0001'::char(5),
  null,
  'club session queue rejects inactive players at the database boundary'
);

select throws_ok(
  $$insert into public.club_session_matches
      (session_id, owner_id, match_id, court_id,
       team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
       queue_order, is_open_fallback)
    values
      ('00000000-0000-4000-8000-000000001001', tests.get_supabase_uid('club_owner'),
       '00000000-0000-4000-8000-000000001052', '00000000-0000-4000-8000-000000001021',
       '00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001012',
       '00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001014',
       1, true)$$,
  'P0001'::char(5),
  null,
  'open pairing sessions reject open fallback flags'
);

select throws_ok(
  $$select public.queue_club_session_matches(
      '00000000-0000-4000-8000-000000001001',
      '2000-01-01T00:00:00Z'::timestamptz,
      '[]'::jsonb)$$,
  'P0001'::char(5),
  'CLUB_SESSION_ROTATION_STALE',
  'atomic Club Session queue rejects a stale session snapshot'
);

select is(
  (select count(*)::integer from public.club_sessions),
  6,
  'the owner can read their sessions'
);
select is(
  (select count(*)::integer from public.club_session_players),
  5,
  'the owner can read the full session roster'
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
  '{"id":"00000000-0000-4000-8000-000000001041","ruleset":{"source":"official"}}'::jsonb,
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

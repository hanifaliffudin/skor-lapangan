begin;
select plan(15);

select tests.create_supabase_user('rule_creator');
select tests.create_supabase_user('rule_reader');
select tests.authenticate_as('rule_creator');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('rule_creator'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);

select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000201',
    0,
    'pickleball',
    'Club night doubles',
    'A local format used by the group.',
    '{
      "pointsToWin": 15,
      "winBy": 2,
      "maxPoints": null,
      "bestOf": 3,
      "scoringMode": "side_out",
      "serversPerTurn": 2,
      "openingServerNumber": 2
    }'::jsonb,
    true
  ),
  1,
  'Google-linked creator can publish the first version'
);

select is(
  public.save_community_rule(
    '00000000-0000-4000-8000-000000000201',
    1,
    'pickleball',
    'Club night doubles v2',
    'Updated local format.',
    '{
      "pointsToWin": 11,
      "winBy": 2,
      "maxPoints": null,
      "bestOf": 3,
      "scoringMode": "side_out",
      "serversPerTurn": 2,
      "openingServerNumber": 2
    }'::jsonb,
    true
  ),
  2,
  'editing a rule publishes a new version'
);

select tests.authenticate_as('rule_reader');
set local role anon;
select is(
  (select count(*)::integer from public.list_community_rules()
   where id = '00000000-0000-4000-8000-000000000201'),
  1,
  'published community rule is listed without an account'
);
select is(
  (select title from public.read_community_rule('00000000-0000-4000-8000-000000000201')),
  'Club night doubles v2',
  'public can read safe published rule fields'
);
select ok(
  (select not is_owner from public.read_community_rule('00000000-0000-4000-8000-000000000201')),
  'public reader is not identified as the owner'
);
select is(
  (select configuration ->> 'pointsToWin'
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000201', 2)),
  '11',
  'public can read a published version configuration'
);
select ok(
  not has_table_privilege('anon', 'public.community_rules', 'select')
  and not has_table_privilege('authenticated', 'public.community_rules', 'select')
  and not has_table_privilege('anon', 'public.community_rule_versions', 'select')
  and not has_table_privilege('authenticated', 'public.community_rule_versions', 'select'),
  'client roles cannot select directly from rule tables'
);
select ok(
  not has_column_privilege('anon', 'public.community_rules', 'author_id', 'select')
  and not has_column_privilege('authenticated', 'public.community_rules', 'author_id', 'select'),
  'client roles have no direct privilege on rule author IDs'
);
select ok(
  not has_column_privilege('anon', 'public.community_rule_versions', 'created_by', 'select')
  and not has_column_privilege('authenticated', 'public.community_rule_versions', 'created_by', 'select'),
  'client roles have no direct privilege on version creator IDs'
);
select ok(
  position('author_id' in pg_get_function_result('public.list_community_rules()'::regprocedure)) = 0
  and position('author_id' in pg_get_function_result('public.read_community_rule(uuid)'::regprocedure)) = 0
  and position('created_by' in pg_get_function_result('public.read_community_rule_version(uuid,integer)'::regprocedure)) = 0,
  'public RPC response schemas omit creator identifiers'
);
reset role;

select tests.authenticate_as('rule_creator');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('rule_creator'),
    'role', 'authenticated',
    'is_anonymous', false,
    'app_metadata', json_build_object(
      'provider', 'google',
      'providers', json_build_array('google')
    )
  )::text,
  true
);
select ok(
  public.unpublish_community_rule('00000000-0000-4000-8000-000000000201'),
  'creator can unpublish without approval'
);
select is(
  (select count(*)::integer from public.list_community_rules()
   where id = '00000000-0000-4000-8000-000000000201' and is_owner and not is_published),
  1,
  'creator can still list their unpublished rule without exposing their ID'
);
select is(
  (select count(*)::integer
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000201', 2)),
  1,
  'creator can read a version of their unpublished rule'
);

select tests.authenticate_as('rule_reader');
set local role anon;
select is(
  (select count(*)::integer from public.list_community_rules()
   where id = '00000000-0000-4000-8000-000000000201'),
  0,
  'unpublished rules are hidden from public listings'
);
select is(
  (select count(*)::integer
   from public.read_community_rule_version('00000000-0000-4000-8000-000000000201', 2)),
  0,
  'unpublished rule versions are hidden from public readers'
);

select * from finish();
rollback;

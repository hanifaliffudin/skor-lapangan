begin;
select plan(7);

select tests.create_supabase_user('republish_creator');
select tests.authenticate_as('republish_creator');
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_supabase_uid('republish_creator'),
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
    '00000000-0000-4000-8000-000000000203',
    0,
    'pickleball',
    'Republish test',
    'A rule used to verify republishing.',
    '{
      "schemaVersion": 2,
      "scoring": {
        "pointsToWin": 15,
        "winBy": 2,
        "maxPoints": null,
        "bestOf": 3,
        "scoringMode": "side_out",
        "serversPerTurn": 2,
        "openingServerNumber": 2
      }
    }'::jsonb,
    true
  ),
  1,
  'republish test starts at version one'
);

select ok(
  public.unpublish_community_rule('00000000-0000-4000-8000-000000000203'),
  'owner can unpublish the rule'
);
select ok(
  public.publish_community_rule('00000000-0000-4000-8000-000000000203'),
  'owner can publish the rule again'
);
select ok(
  (select is_published
   from public.community_rules
   where id = '00000000-0000-4000-8000-000000000203'),
  'republished rule is public again'
);
select is(
  (select current_version
   from public.community_rules
   where id = '00000000-0000-4000-8000-000000000203'),
  1,
  'republishing does not increment the version'
);
select is(
  (select count(*)::integer
   from public.community_rule_versions
   where rule_id = '00000000-0000-4000-8000-000000000203'),
  1,
  'republishing does not create a new version row'
);
select is(
  (select configuration -> 'scoring' ->> 'pointsToWin'
   from public.community_rule_versions
   where rule_id = '00000000-0000-4000-8000-000000000203'
     and version = 1),
  '15',
  'republishing keeps the existing configuration'
);

select * from finish();
rollback;

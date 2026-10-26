begin;

select plan(12);

select ok(
  to_regclass('public.matches_owner_updated_id_idx') is not null,
  'history has a stable keyset pagination index'
);
select ok(
  to_regclass('public.matches_owner_status_updated_idx') is not null,
  'history status grouping has a supporting index'
);
select ok(
  to_regclass('public.matches_viewer_token_hash_idx') is not null,
  'live viewer token lookups have a supporting index'
);
select ok(
  to_regclass('public.community_rules_public_updated_id_idx') is not null,
  'public rules pagination has a supporting index'
);
select ok(
  to_regprocedure('public.list_my_match_summaries(integer,timestamptz,uuid)')
    is not null,
  'account history pagination RPC exists'
);
select ok(
  to_regprocedure('public.list_my_match_summaries(text,text,text,text,timestamptz,timestamptz,text,integer,timestamptz,uuid)')
    is not null,
  'filtered account history RPC exists'
);
select ok(
  to_regprocedure('public.get_my_match_statistics(text,text,text,timestamptz,timestamptz,uuid[])')
    is not null,
  'account match statistics RPC exists'
);
select ok(
  to_regprocedure('public.list_community_rules_page(text,integer,timestamptz,uuid)')
    is not null,
  'community rules pagination RPC exists'
);
select ok(
  to_regprocedure('public.list_community_rules_page(text,text,text,integer,timestamptz,uuid)')
    is not null,
  'filtered community rules RPC exists'
);
select ok(
  to_regprocedure('public.read_match_head(uuid)') is not null,
  'match head RPC exists'
);
select ok(
  to_regprocedure('public.read_match_events_since(uuid,bigint,integer)')
    is not null,
  'incremental match event RPC exists'
);
select ok(
  to_regprocedure('public.read_match_definition(uuid)') is not null,
  'bounded match definition RPC exists'
);

select * from finish();
rollback;

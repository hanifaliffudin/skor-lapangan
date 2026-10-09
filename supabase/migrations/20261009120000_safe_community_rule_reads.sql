create or replace function public.list_community_rules()
returns table (
  id uuid,
  sport text,
  title text,
  description text,
  current_version integer,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.sport,
    r.title,
    r.description,
    r.current_version,
    r.is_published,
    r.created_at,
    r.updated_at,
    coalesce(r.author_id = (select auth.uid()), false)
  from public.community_rules as r
  where r.is_published or r.author_id = (select auth.uid())
  order by r.updated_at desc;
$$;

revoke all on function public.list_community_rules() from public;
grant execute on function public.list_community_rules() to anon, authenticated;

create or replace function public.read_community_rule(p_rule_id uuid)
returns table (
  id uuid,
  sport text,
  title text,
  description text,
  current_version integer,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.sport,
    r.title,
    r.description,
    r.current_version,
    r.is_published,
    r.created_at,
    r.updated_at,
    coalesce(r.author_id = (select auth.uid()), false)
  from public.community_rules as r
  where r.id = p_rule_id
    and (r.is_published or r.author_id = (select auth.uid()));
$$;

revoke all on function public.read_community_rule(uuid) from public;
grant execute on function public.read_community_rule(uuid) to anon, authenticated;

create or replace function public.read_community_rule_version(
  p_rule_id uuid,
  p_version integer
)
returns table (configuration jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.configuration
  from public.community_rule_versions as v
  join public.community_rules as r on r.id = v.rule_id
  where v.rule_id = p_rule_id
    and v.version = p_version
    and (r.is_published or r.author_id = (select auth.uid()));
$$;

revoke all on function public.read_community_rule_version(uuid, integer) from public;
grant execute on function public.read_community_rule_version(uuid, integer) to anon, authenticated;

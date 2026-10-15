begin;

create or replace function public.list_my_match_summaries(
  p_search text default null,
  p_status text default null,
  p_sport text default null,
  p_sort text default 'newest',
  p_limit integer default 50,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  sport text,
  status text,
  winner text,
  team_a_name text,
  team_b_name text,
  current_state jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.sport,
    m.status,
    m.winner,
    coalesce(m.definition #>> '{teams,A,name}', 'Team A'),
    coalesce(m.definition #>> '{teams,B,name}', 'Team B'),
    m.current_state,
    m.created_at,
    m.updated_at
  from public.matches as m
  where m.owner_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now())
    and (p_status is null or p_status not in ('active', 'complete') or m.status = p_status)
    and (p_sport is null or m.sport = p_sport)
    and (
      nullif(btrim(p_search), '') is null
      or lower(concat_ws(
        ' ',
        m.sport,
        m.id::text,
        m.definition #>> '{teams,A,name}',
        m.definition #>> '{teams,B,name}'
      )) like '%' || lower(btrim(p_search)) || '%'
    )
    and (
      p_before_updated_at is null
      or p_before_id is null
      or (
        p_sort = 'oldest'
        and (m.updated_at, m.id) > (p_before_updated_at, p_before_id)
      )
      or (
        coalesce(p_sort, 'newest') <> 'oldest'
        and (m.updated_at, m.id) < (p_before_updated_at, p_before_id)
      )
    )
  order by
    case when p_sort = 'oldest' then m.updated_at end asc,
    case when p_sort = 'oldest' then m.id end asc,
    case when coalesce(p_sort, 'newest') <> 'oldest' then m.updated_at end desc,
    case when coalesce(p_sort, 'newest') <> 'oldest' then m.id end desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.list_my_match_summaries(
  text, text, text, text, integer, timestamptz, uuid
) from public, anon;
grant execute on function public.list_my_match_summaries(
  text, text, text, text, integer, timestamptz, uuid
) to authenticated;

create or replace function public.list_community_rules_page(
  p_sport text default null,
  p_search text default null,
  p_scope text default 'all',
  p_limit integer default 50,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
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
  where (r.is_published or r.author_id = (select auth.uid()))
    and (p_sport is null or r.sport = p_sport)
    and (
      coalesce(p_scope, 'all') = 'all'
      or (p_scope = 'published' and r.is_published)
      or (p_scope = 'mine' and r.author_id = (select auth.uid()))
    )
    and (
      nullif(btrim(p_search), '') is null
      or lower(concat_ws(' ', r.title, r.description)) like '%' || lower(btrim(p_search)) || '%'
    )
    and (
      p_before_updated_at is null
      or p_before_id is null
      or (r.updated_at, r.id) < (p_before_updated_at, p_before_id)
    )
  order by r.updated_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.list_community_rules_page(
  text, text, text, integer, timestamptz, uuid
) from public;
grant execute on function public.list_community_rules_page(
  text, text, text, integer, timestamptz, uuid
) to anon, authenticated;

commit;

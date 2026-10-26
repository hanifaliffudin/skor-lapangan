begin;

drop function if exists public.list_my_match_summaries(
  text, text, text, text, integer, timestamptz, uuid
);

create function public.list_my_match_summaries(
  p_search text default null,
  p_status text default null,
  p_sport text default null,
  p_winner text default null,
  p_from_updated_at timestamptz default null,
  p_to_updated_at timestamptz default null,
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
    and (p_winner is null or p_winner not in ('A', 'B') or m.winner = p_winner)
    and (p_from_updated_at is null or m.updated_at >= p_from_updated_at)
    and (p_to_updated_at is null or m.updated_at < p_to_updated_at)
    and (
      nullif(btrim(p_search), '') is null
      or lower(concat_ws(
        ' ', m.sport, m.id::text,
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
  text, text, text, text, timestamptz, timestamptz, text, integer, timestamptz, uuid
) from public, anon;
grant execute on function public.list_my_match_summaries(
  text, text, text, text, timestamptz, timestamptz, text, integer, timestamptz, uuid
) to authenticated;

create or replace function public.get_my_match_statistics(
  p_search text default null,
  p_sport text default null,
  p_winner text default null,
  p_from_updated_at timestamptz default null,
  p_to_updated_at timestamptz default null,
  p_exclude_match_ids uuid[] default '{}'
)
returns table (
  sport text,
  completed_matches bigint,
  team_a_wins bigint,
  team_b_wins bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.sport,
    count(*)::bigint,
    count(*) filter (where m.winner = 'A')::bigint,
    count(*) filter (where m.winner = 'B')::bigint
  from public.matches as m
  where m.owner_id = (select auth.uid())
    and m.status = 'complete'
    and (m.expires_at is null or m.expires_at > now())
    and not (m.id = any(coalesce(p_exclude_match_ids, '{}'::uuid[])))
    and (p_sport is null or m.sport = p_sport)
    and (p_winner is null or p_winner not in ('A', 'B') or m.winner = p_winner)
    and (p_from_updated_at is null or m.updated_at >= p_from_updated_at)
    and (p_to_updated_at is null or m.updated_at < p_to_updated_at)
    and (
      nullif(btrim(p_search), '') is null
      or lower(concat_ws(
        ' ', m.sport, m.id::text,
        m.definition #>> '{teams,A,name}',
        m.definition #>> '{teams,B,name}'
      )) like '%' || lower(btrim(p_search)) || '%'
    )
  group by m.sport;
$$;

revoke all on function public.get_my_match_statistics(
  text, text, text, timestamptz, timestamptz, uuid[]
) from public, anon;
grant execute on function public.get_my_match_statistics(
  text, text, text, timestamptz, timestamptz, uuid[]
) to authenticated;

commit;

begin;

create index if not exists matches_owner_updated_id_idx
  on public.matches (owner_id, updated_at desc, id desc);

create index if not exists matches_owner_status_updated_idx
  on public.matches (owner_id, status, updated_at desc, id desc);

create index if not exists matches_viewer_token_hash_idx
  on public.matches (viewer_token_hash, viewer_expires_at)
  where viewer_token_hash is not null;

create index if not exists community_rules_public_updated_id_idx
  on public.community_rules (updated_at desc, id desc)
  where is_published;

create or replace function public.list_my_match_summaries(
  p_limit integer default 50,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  sport text,
  status text,
  winner text,
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
    m.current_state,
    m.created_at,
    m.updated_at
  from public.matches as m
  where m.owner_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now())
    and (
      p_before_updated_at is null
      or p_before_id is null
      or (m.updated_at, m.id) < (p_before_updated_at, p_before_id)
    )
  order by m.updated_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.list_my_match_summaries(integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.list_my_match_summaries(integer, timestamptz, uuid)
  to authenticated;

create or replace function public.list_community_rules_page(
  p_sport text default null,
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
      p_before_updated_at is null
      or p_before_id is null
      or (r.updated_at, r.id) < (p_before_updated_at, p_before_id)
    )
  order by r.updated_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.list_community_rules_page(text, integer, timestamptz, uuid)
  from public;
grant execute on function public.list_community_rules_page(text, integer, timestamptz, uuid)
  to anon, authenticated;

create or replace function public.read_match_head(p_match_id uuid)
returns table (
  id uuid,
  sport text,
  status text,
  winner text,
  current_state jsonb,
  last_client_sequence bigint,
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
    m.current_state,
    m.last_client_sequence,
    m.updated_at
  from public.matches as m
  where m.id = p_match_id
    and m.owner_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now());
$$;

revoke all on function public.read_match_head(uuid) from public, anon;
grant execute on function public.read_match_head(uuid) to authenticated;

create or replace function public.read_match_events_since(
  p_match_id uuid,
  p_after_sequence bigint default 0,
  p_limit integer default 2000
)
returns table (
  id uuid,
  match_id uuid,
  client_sequence bigint,
  event_type text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id,
    e.match_id,
    e.client_sequence,
    e.event_type,
    e.payload,
    e.created_at
  from public.match_events as e
  join public.matches as m
    on m.id = e.match_id
   and m.owner_id = e.owner_id
  where e.match_id = p_match_id
    and e.owner_id = (select auth.uid())
    and e.client_sequence > greatest(coalesce(p_after_sequence, 0), 0)
    and (m.expires_at is null or m.expires_at > now())
  order by e.client_sequence
  limit least(greatest(coalesce(p_limit, 2000), 1), 2000);
$$;

revoke all on function public.read_match_events_since(uuid, bigint, integer)
  from public, anon;
grant execute on function public.read_match_events_since(uuid, bigint, integer)
  to authenticated;

commit;

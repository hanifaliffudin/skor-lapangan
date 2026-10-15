begin;

create or replace function public.read_match_definition(p_match_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  sport text,
  status text,
  winner text,
  definition jsonb,
  current_state jsonb,
  last_client_sequence bigint,
  created_at timestamptz,
  updated_at timestamptz,
  event_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.owner_id,
    m.sport,
    m.status,
    m.winner,
    m.definition,
    m.current_state,
    m.last_client_sequence,
    m.created_at,
    m.updated_at,
    (
      select count(*)
      from public.match_events as e
      where e.match_id = m.id
        and e.owner_id = m.owner_id
    ) as event_count
  from public.matches as m
  where m.id = p_match_id
    and m.owner_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now());
$$;

revoke all on function public.read_match_definition(uuid) from public, anon;
grant execute on function public.read_match_definition(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

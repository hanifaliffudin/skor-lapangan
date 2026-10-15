begin;

alter table public.matches
  add column if not exists control_token_hash text,
  add column if not exists control_heartbeat_at timestamptz,
  add column if not exists control_expires_at timestamptz;

create index if not exists matches_control_expiry_idx
  on public.matches (control_expires_at)
  where control_expires_at is not null;

create or replace function public.prevent_match_state_regression()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.last_client_sequence = old.last_client_sequence
     and new.sport is not distinct from old.sport
     and new.ruleset_id is not distinct from old.ruleset_id
     and new.mode is not distinct from old.mode
     and new.definition is not distinct from old.definition
     and new.status is not distinct from old.status
     and new.winner is not distinct from old.winner
     and new.current_state is not distinct from old.current_state
     and new.is_guest is not distinct from old.is_guest then
    new.last_activity_at := old.last_activity_at;
    new.expires_at := old.expires_at;
    new.updated_at := old.updated_at;
    return new;
  end if;

  if new.last_client_sequence < old.last_client_sequence then
    return old;
  end if;

  if old.is_guest and not new.is_guest then
    new.last_activity_at := now();
    new.expires_at := null;
  elsif new.last_client_sequence > old.last_client_sequence then
    new.last_activity_at := now();
    if new.is_guest then
      new.expires_at := now() + interval '12 hours';
    end if;
  else
    new.last_activity_at := old.last_activity_at;
    new.expires_at := old.expires_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.read_match_journal(p_match_id uuid)
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
  events jsonb
)
language sql
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
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'match_id', e.match_id,
            'client_sequence', e.client_sequence,
            'event_type', e.event_type,
            'payload', e.payload,
            'created_at', e.created_at
          ) order by e.client_sequence
        )
        from public.match_events e
        where e.match_id = m.id
          and e.owner_id = m.owner_id
      ),
      '[]'::jsonb
    ) as events
  from public.matches m
  where m.id = p_match_id
    and m.owner_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now());
$$;

revoke all on function public.read_match_journal(uuid) from public, anon;
grant execute on function public.read_match_journal(uuid) to authenticated;

create or replace function public.acquire_match_control(
  p_match_id uuid,
  p_control_token text,
  p_force boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_status text;
  token_hash text;
begin
  if auth.uid() is null
     or p_match_id is null
     or p_control_token is null
     or length(p_control_token) < 16 then
    raise exception using errcode = '22023', message = 'Invalid match control payload.';
  end if;

  select m.status
  into match_status
  from public.matches m
  where m.id = p_match_id
    and m.owner_id = auth.uid()
    and (m.expires_at is null or m.expires_at > now())
  for update;

  if not found then
    return 'not_found';
  end if;

  if match_status = 'complete' then
    return 'complete';
  end if;

  token_hash := encode(extensions.digest(p_control_token, 'sha256'), 'hex');

  if not p_force
     and exists (
       select 1
       from public.matches m
       where m.id = p_match_id
         and m.control_token_hash is not null
         and m.control_expires_at > now()
         and m.control_token_hash <> token_hash
     ) then
    return 'held';
  end if;

  update public.matches
  set control_token_hash = token_hash,
      control_heartbeat_at = now(),
      control_expires_at = now() + interval '45 seconds'
  where id = p_match_id
    and owner_id = auth.uid();

  return 'acquired';
end;
$$;

revoke all on function public.acquire_match_control(uuid, text, boolean)
  from public, anon;
grant execute on function public.acquire_match_control(uuid, text, boolean)
  to authenticated;

create or replace function public.renew_match_control(
  p_match_id uuid,
  p_control_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_hash text;
begin
  if auth.uid() is null or p_control_token is null then
    return false;
  end if;

  token_hash := encode(extensions.digest(p_control_token, 'sha256'), 'hex');

  update public.matches
  set control_heartbeat_at = now(),
      control_expires_at = now() + interval '45 seconds'
  where id = p_match_id
    and owner_id = auth.uid()
    and status = 'active'
    and control_token_hash = token_hash
    and control_expires_at > now();

  return found;
end;
$$;

revoke all on function public.renew_match_control(uuid, text) from public, anon;
grant execute on function public.renew_match_control(uuid, text) to authenticated;

create or replace function public.release_match_control(
  p_match_id uuid,
  p_control_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_hash text;
begin
  if auth.uid() is null or p_control_token is null then
    return false;
  end if;

  token_hash := encode(extensions.digest(p_control_token, 'sha256'), 'hex');

  update public.matches
  set control_token_hash = null,
      control_heartbeat_at = null,
      control_expires_at = null
  where id = p_match_id
    and owner_id = auth.uid()
    and control_token_hash = token_hash;

  return found;
end;
$$;

revoke all on function public.release_match_control(uuid, text) from public, anon;
grant execute on function public.release_match_control(uuid, text) to authenticated;

drop function if exists public.sync_match_journal(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  bigint,
  timestamptz,
  boolean,
  jsonb
);

create or replace function public.sync_match_journal(
  p_match_id uuid,
  p_owner_id uuid,
  p_sport text,
  p_ruleset_id text,
  p_mode text,
  p_definition jsonb,
  p_status text,
  p_winner text,
  p_current_state jsonb,
  p_last_client_sequence bigint,
  p_created_at timestamptz,
  p_is_guest boolean,
  p_control_token text,
  p_events jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_sequence bigint;
  current_state jsonb;
  current_status text;
  current_definition jsonb;
  match_exists boolean := false;
  event_row jsonb;
  token_hash text;
begin
  if auth.uid() is distinct from p_owner_id then
    raise exception using errcode = '42501', message = 'Match owner does not match the current user.';
  end if;

  if p_match_id is null
     or p_sport is null
     or p_ruleset_id is null
     or p_mode is null
     or p_definition is null
     or p_current_state is null
     or p_last_client_sequence < 0
     or jsonb_typeof(coalesce(p_events, '[]'::jsonb)) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid match journal payload.';
  end if;

  if p_status = 'active' and (p_control_token is null or length(p_control_token) < 16) then
    raise exception using errcode = '42501', message = 'CONTROL_LOST';
  end if;

  token_hash := encode(extensions.digest(coalesce(p_control_token, ''), 'sha256'), 'hex');

  select m.last_client_sequence, m.current_state, m.status, m.definition
  into current_sequence, current_state, current_status, current_definition
  from public.matches m
  where m.id = p_match_id
    and m.owner_id = p_owner_id
  for update;

  match_exists := found;

  if match_exists and current_status = 'complete' then
    if current_sequence > p_last_client_sequence then
      return 'stale';
    end if;
    if current_sequence = p_last_client_sequence then
      if current_state is distinct from p_current_state then
        return 'conflict';
      end if;
      if not p_is_guest
         and not (current_definition ? 'teams')
         and (p_definition ? 'teams') then
        update public.matches
        set definition = p_definition
        where id = p_match_id and owner_id = p_owner_id;
      end if;
      return 'already_synced';
    end if;
    return 'conflict';
  end if;

  if match_exists and current_status = 'active'
     and not exists (
       select 1
       from public.matches m
       where m.id = p_match_id
         and m.owner_id = p_owner_id
         and m.control_token_hash = token_hash
         and m.control_expires_at > now()
     ) then
    raise exception using errcode = '42501', message = 'CONTROL_LOST';
  end if;

  if match_exists and current_sequence > p_last_client_sequence then
    return 'stale';
  end if;

  if match_exists
     and current_sequence = p_last_client_sequence then
    if current_state is distinct from p_current_state then
      return 'conflict';
    end if;
    if not p_is_guest
       and not (current_definition ? 'teams')
       and (p_definition ? 'teams') then
      update public.matches
      set definition = p_definition
      where id = p_match_id and owner_id = p_owner_id;
    end if;
  elsif match_exists then
    update public.matches
    set sport = p_sport,
        ruleset_id = p_ruleset_id,
        mode = p_mode,
        definition = p_definition,
        status = p_status,
        winner = p_winner,
        current_state = p_current_state,
        last_client_sequence = p_last_client_sequence,
        is_guest = p_is_guest,
        control_token_hash = case when p_status = 'active' then token_hash else null end,
        control_heartbeat_at = case when p_status = 'active' then now() else null end,
        control_expires_at = case when p_status = 'active' then now() + interval '45 seconds' else null end
    where id = p_match_id
      and owner_id = p_owner_id;
  else
    insert into public.matches (
      id,
      owner_id,
      sport,
      ruleset_id,
      mode,
      definition,
      status,
      winner,
      current_state,
      last_client_sequence,
      created_at,
      is_guest,
      control_token_hash,
      control_heartbeat_at,
      control_expires_at
    ) values (
      p_match_id,
      p_owner_id,
      p_sport,
      p_ruleset_id,
      p_mode,
      p_definition,
      p_status,
      p_winner,
      p_current_state,
      p_last_client_sequence,
      p_created_at,
      p_is_guest,
      case when p_status = 'active' then token_hash else null end,
      case when p_status = 'active' then now() else null end,
      case when p_status = 'active' then now() + interval '45 seconds' else null end
    );
  end if;

  for event_row in
    select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    if jsonb_typeof(event_row) is distinct from 'object'
       or event_row ->> 'id' is null
       or event_row ->> 'client_sequence' is null
       or event_row ->> 'event_type' is null
       or event_row -> 'payload' is null
       or event_row ->> 'created_at' is null then
      raise exception using errcode = '22023', message = 'Invalid match event payload.';
    end if;

    insert into public.match_events (
      id,
      match_id,
      owner_id,
      client_sequence,
      event_type,
      payload,
      created_at
    ) values (
      (event_row ->> 'id')::uuid,
      p_match_id,
      p_owner_id,
      (event_row ->> 'client_sequence')::bigint,
      event_row ->> 'event_type',
      event_row -> 'payload',
      (event_row ->> 'created_at')::timestamptz
    ) on conflict (id) do nothing;
  end loop;

  if p_status = 'active' then
    update public.matches
    set control_token_hash = token_hash,
        control_heartbeat_at = now(),
        control_expires_at = now() + interval '45 seconds'
    where id = p_match_id and owner_id = p_owner_id;
  else
    update public.matches
    set control_token_hash = null,
        control_heartbeat_at = null,
        control_expires_at = null
    where id = p_match_id and owner_id = p_owner_id;
  end if;

  return case
    when not match_exists then 'applied'
    when current_sequence < p_last_client_sequence then 'applied'
    else 'already_synced'
  end;
end;
$$;

revoke all on function public.sync_match_journal(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  bigint,
  timestamptz,
  boolean,
  text,
  jsonb
) from public, anon;
grant execute on function public.sync_match_journal(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  bigint,
  timestamptz,
  boolean,
  text,
  jsonb
) to authenticated;

notify pgrst, 'reload schema';
commit;

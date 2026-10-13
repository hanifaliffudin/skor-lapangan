begin;

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
  match_exists boolean := false;
  event_row jsonb;
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

  select m.last_client_sequence, m.current_state
  into current_sequence, current_state
  from public.matches m
  where m.id = p_match_id
    and m.owner_id = p_owner_id
  for update;

  match_exists := found;

  if match_exists and current_sequence > p_last_client_sequence then
    return 'stale';
  end if;

  if match_exists
     and current_sequence = p_last_client_sequence then
    if current_state is distinct from p_current_state then
      return 'conflict';
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
        is_guest = p_is_guest
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
      is_guest
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
      p_is_guest
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
  jsonb
) to authenticated;

notify pgrst, 'reload schema';
commit;

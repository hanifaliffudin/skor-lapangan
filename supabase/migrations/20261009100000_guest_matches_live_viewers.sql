create extension if not exists pgcrypto with schema extensions;

alter table public.matches
  add column is_guest boolean not null default false,
  add column last_activity_at timestamptz not null default now(),
  add column expires_at timestamptz,
  add column viewer_token_hash text,
  add column viewer_expires_at timestamptz,
  add column viewer_revoked_at timestamptz;

update public.matches
set last_activity_at = updated_at;

create index matches_guest_expiry_idx
  on public.matches (expires_at)
  where is_guest and expires_at is not null;

create or replace function public.prevent_match_state_regression()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
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

create or replace function public.sanitize_guest_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_games jsonb;
begin
  if not new.is_guest then
    return new;
  end if;

  new.definition := jsonb_strip_nulls(jsonb_build_object(
    'id', new.definition -> 'id',
    'sport', new.definition -> 'sport',
    'rulesetId', new.definition -> 'rulesetId',
    'mode', new.definition -> 'mode',
    'createdAt', new.definition -> 'createdAt',
    'initialServingTeam', new.definition -> 'initialServingTeam',
    'initialServingPlayer', new.definition -> 'initialServingPlayer'
  ));

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'winner', game.value -> 'winner',
      'score', jsonb_build_object(
        'A', game.value -> 'score' -> 'A',
        'B', game.value -> 'score' -> 'B'
      )
    ) order by game.ordinality),
    '[]'::jsonb
  ) into completed_games
  from jsonb_array_elements(
    case
      when jsonb_typeof(new.current_state -> 'completedGames') = 'array'
        then new.current_state -> 'completedGames'
      else '[]'::jsonb
    end
  ) with ordinality as game(value, ordinality);

  new.current_state := jsonb_build_object(
    'matchId', new.current_state -> 'matchId',
    'sport', new.current_state -> 'sport',
    'gameNumber', new.current_state -> 'gameNumber',
    'gamesWon', jsonb_build_object(
      'A', new.current_state -> 'gamesWon' -> 'A',
      'B', new.current_state -> 'gamesWon' -> 'B'
    ),
    'points', jsonb_build_object(
      'A', new.current_state -> 'points' -> 'A',
      'B', new.current_state -> 'points' -> 'B'
    ),
    'servingTeam', new.current_state -> 'servingTeam',
    'currentServer', new.current_state -> 'currentServer',
    'serverNumber', new.current_state -> 'serverNumber',
    'positions', jsonb_build_object(
      'A', jsonb_build_object(
        'left', new.current_state -> 'positions' -> 'A' -> 'left',
        'right', new.current_state -> 'positions' -> 'A' -> 'right'
      ),
      'B', jsonb_build_object(
        'left', new.current_state -> 'positions' -> 'B' -> 'left',
        'right', new.current_state -> 'positions' -> 'B' -> 'right'
      )
    ),
    'status', new.current_state -> 'status',
    'winner', new.current_state -> 'winner',
    'completedGames', completed_games
  );
  return new;
end;
$$;

create trigger matches_sanitize_guest_payload
before insert or update on public.matches
for each row execute function public.sanitize_guest_match_payload();

create or replace function public.sanitize_match_event_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'rally_awarded' then
    new.payload := jsonb_build_object('team', new.payload -> 'team');
  elsif new.event_type = 'state_overridden' then
    new.payload := jsonb_build_object(
      'points', jsonb_build_object(
        'A', new.payload -> 'points' -> 'A',
        'B', new.payload -> 'points' -> 'B'
      )
    );
  else
    new.payload := jsonb_build_object('targetEventId', new.payload -> 'targetEventId');
  end if;
  return new;
end;
$$;

create trigger match_events_sanitize_payload
before insert on public.match_events
for each row execute function public.sanitize_match_event_payload();

create or replace function public.initialize_match_retention()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.last_activity_at := now();
  new.updated_at := now();
  if new.is_guest then
    new.expires_at := now() + interval '12 hours';
  else
    new.expires_at := null;
  end if;
  return new;
end;
$$;

create trigger matches_initialize_retention
before insert on public.matches
for each row execute function public.initialize_match_retention();

drop policy if exists "owners_select_matches" on public.matches;
drop policy if exists "owners_insert_matches" on public.matches;
drop policy if exists "owners_update_matches" on public.matches;
drop policy if exists "owners_delete_matches" on public.matches;
drop policy if exists "owners_select_match_events" on public.match_events;
drop policy if exists "owners_insert_match_events" on public.match_events;

create policy "owners_select_unexpired_matches"
on public.matches
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  and (expires_at is null or expires_at > now())
);

create policy "owners_insert_matches"
on public.matches
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and is_guest = coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
);

create policy "owners_update_unexpired_matches"
on public.matches
for update
to authenticated
using (
  (select auth.uid()) = owner_id
  and (expires_at is null or expires_at > now())
)
with check (
  (select auth.uid()) = owner_id
  and is_guest = coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
);

create policy "owners_delete_matches"
on public.matches
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners_select_unexpired_match_events"
on public.match_events
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.owner_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  )
);

create policy "owners_insert_unexpired_match_events"
on public.match_events
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.owner_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  )
);

create or replace function public.claim_guest_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not coalesce(
       ((auth.jwt() -> 'app_metadata' -> 'providers') ? 'google')
       or auth.jwt() -> 'app_metadata' ->> 'provider' = 'google',
       false
     ) then
    raise exception 'A Google-linked account is required to claim guest matches.';
  end if;

  update public.matches
  set is_guest = false,
      expires_at = null
  where owner_id = auth.uid()
    and is_guest
    and expires_at > now();

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.claim_guest_matches() from public, anon;
grant execute on function public.claim_guest_matches() to authenticated;

create or replace function public.create_live_viewer_link(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_token text;
  match_expiry timestamptz;
begin
  select m.expires_at into match_expiry
  from public.matches m
  where m.id = p_match_id
    and m.owner_id = auth.uid()
    and (m.expires_at is null or m.expires_at > now());

  if not found then
    raise exception 'Match is unavailable.';
  end if;

  viewer_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.matches
  set viewer_token_hash = encode(extensions.digest(viewer_token, 'sha256'), 'hex'),
      viewer_expires_at = least(coalesce(match_expiry, now() + interval '24 hours'), now() + interval '24 hours'),
      viewer_revoked_at = null
  where id = p_match_id and owner_id = auth.uid();

  return viewer_token;
end;
$$;

revoke all on function public.create_live_viewer_link(uuid) from public, anon;
grant execute on function public.create_live_viewer_link(uuid) to authenticated;

create or replace function public.revoke_live_viewer_link(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matches
  set viewer_revoked_at = now(), viewer_token_hash = null
  where id = p_match_id and owner_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.revoke_live_viewer_link(uuid) from public, anon;
grant execute on function public.revoke_live_viewer_link(uuid) to authenticated;

create or replace function public.read_live_viewer(p_token text)
returns table (
  sport text,
  status text,
  current_state jsonb,
  updated_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select m.sport, m.status, m.current_state, m.updated_at, m.viewer_expires_at
  from public.matches m
  where p_token is not null
    and m.viewer_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and m.viewer_revoked_at is null
    and m.viewer_expires_at > now()
    and (m.expires_at is null or m.expires_at > now())
  limit 1;
$$;

revoke all on function public.read_live_viewer(text) from public;
grant execute on function public.read_live_viewer(text) to anon, authenticated;

create or replace function public.purge_expired_guest_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.matches
  where is_guest and expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_guest_matches() from public, anon, authenticated;
grant execute on function public.purge_expired_guest_matches() to service_role;

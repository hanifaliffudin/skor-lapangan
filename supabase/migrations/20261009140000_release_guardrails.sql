create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.action_rate_limits (
  actor_key text not null,
  action text not null check (action in (
    'guest_match_create',
    'guest_match_state',
    'guest_match_event',
    'live_viewer_create',
    'live_viewer_read',
    'community_rule_report'
  )),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (actor_key, action, window_started_at)
);

create index if not exists action_rate_limits_window_idx
  on private.action_rate_limits (window_started_at);

alter table private.action_rate_limits enable row level security;
revoke all on private.action_rate_limits from public, anon, authenticated;

create or replace function private.take_rate_limit(
  p_actor_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_request_count integer;
begin
  if p_actor_key is null or length(p_actor_key) > 200 then
    raise exception 'Invalid rate-limit actor.';
  end if;
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into private.action_rate_limits as counters (
    actor_key,
    action,
    window_started_at,
    request_count
  ) values (
    p_actor_key,
    p_action,
    v_window_start,
    1
  )
  on conflict (actor_key, action, window_started_at)
  do update set request_count = least(counters.request_count + 1, p_max_requests + 1)
  returning counters.request_count into v_request_count;

  return v_request_count <= p_max_requests;
end;
$$;

revoke all on function private.take_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

alter table public.matches
  add column if not exists hard_expires_at timestamptz;

update public.matches
set hard_expires_at = created_at + interval '24 hours',
    expires_at = least(
      coalesce(expires_at, last_activity_at + interval '12 hours'),
      created_at + interval '24 hours'
    )
where is_guest;

update public.matches
set hard_expires_at = null
where not is_guest;

update public.matches
set viewer_expires_at = least(
  viewer_expires_at,
  now() + interval '12 hours',
  coalesce(expires_at, now() + interval '12 hours')
)
where viewer_token_hash is not null
  and viewer_expires_at > now();

create or replace function public.initialize_match_retention()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = new.owner_id then
    new.is_guest := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  end if;
  new.last_activity_at := now();
  new.updated_at := now();
  if new.is_guest then
    new.hard_expires_at := now() + interval '24 hours';
    new.expires_at := now() + interval '12 hours';
  else
    new.hard_expires_at := null;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_match_state_regression()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = new.owner_id
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    new.is_guest := true;
  end if;

  if new.last_client_sequence < old.last_client_sequence then
    return old;
  end if;

  if old.is_guest and not new.is_guest then
    if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
      raise exception using errcode = '42501', message = 'A guest match can only be retained after linking an account.';
    end if;
    new.last_activity_at := now();
    new.expires_at := null;
    new.hard_expires_at := null;
  elsif not old.is_guest and new.is_guest then
    new.last_activity_at := old.last_activity_at;
    new.hard_expires_at := old.created_at + interval '24 hours';
    new.expires_at := least(
      old.last_activity_at + interval '12 hours',
      new.hard_expires_at
    );
  elsif new.last_client_sequence > old.last_client_sequence then
    new.last_activity_at := now();
    if new.is_guest then
      new.hard_expires_at := coalesce(
        old.hard_expires_at,
        old.created_at + interval '24 hours'
      );
      new.expires_at := least(
        now() + interval '12 hours',
        new.hard_expires_at
      );
    end if;
  else
    new.last_activity_at := old.last_activity_at;
    if old.is_guest then
      new.hard_expires_at := coalesce(
        old.hard_expires_at,
        old.created_at + interval '24 hours'
      );
      new.expires_at := least(
        coalesce(old.expires_at, old.last_activity_at + interval '12 hours'),
        new.hard_expires_at
      );
    else
      new.expires_at := old.expires_at;
      new.hard_expires_at := old.hard_expires_at;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

update public.matches
set hard_expires_at = coalesce(hard_expires_at, created_at + interval '24 hours')
where is_guest;

create or replace function private.enforce_guest_match_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.owner_id = auth.uid()
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    new.is_guest := true;
    if tg_op = 'INSERT' then
      if not exists (
        select 1 from public.matches m where m.id = new.id
      ) and not private.take_rate_limit(
        auth.uid()::text,
        'guest_match_create',
        10,
        3600
      ) then
        raise exception using errcode = 'P0001', message = 'RATE_LIMIT: guest_match_create';
      end if;
    elsif old.is_guest
       and new.last_client_sequence > old.last_client_sequence
       and not private.take_rate_limit(
         auth.uid()::text,
         'guest_match_state',
         500,
         3600
       ) then
      raise exception using errcode = 'P0001', message = 'RATE_LIMIT: guest_match_state';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_guest_match_rate_limit()
  from public, anon, authenticated;

drop trigger if exists matches_guest_rate_limit on public.matches;
create trigger matches_guest_rate_limit
before insert or update on public.matches
for each row execute function private.enforce_guest_match_rate_limit();

update public.matches m
set is_guest = true
from auth.users u
where u.id = m.owner_id
  and u.is_anonymous
  and not m.is_guest;

update public.matches
set viewer_expires_at = least(viewer_expires_at, expires_at)
where is_guest
  and viewer_token_hash is not null
  and viewer_expires_at > now()
  and expires_at < viewer_expires_at;

create or replace function private.enforce_guest_event_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.owner_id = auth.uid()
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and exists (
       select 1
       from public.matches m
       where m.id = new.match_id
         and m.owner_id = new.owner_id
         and m.is_guest
     )
     and not exists (
       select 1 from public.match_events e where e.id = new.id
     )
     and not private.take_rate_limit(
       auth.uid()::text,
       'guest_match_event',
       500,
       3600
     ) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT: guest_match_event';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_guest_event_rate_limit()
  from public, anon, authenticated;

drop trigger if exists match_events_guest_rate_limit on public.match_events;
create trigger match_events_guest_rate_limit
before insert on public.match_events
for each row execute function private.enforce_guest_event_rate_limit();

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

  if not private.take_rate_limit(auth.uid()::text, 'live_viewer_create', 10, 3600) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT: live_viewer_create';
  end if;

  viewer_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.matches
  set viewer_token_hash = encode(extensions.digest(viewer_token, 'sha256'), 'hex'),
      viewer_expires_at = least(
        coalesce(match_expiry, now() + interval '12 hours'),
        now() + interval '12 hours'
      ),
      viewer_revoked_at = null
  where id = p_match_id and owner_id = auth.uid();

  return viewer_token;
end;
$$;

revoke all on function public.create_live_viewer_link(uuid) from public, anon;
grant execute on function public.create_live_viewer_link(uuid) to authenticated;

create or replace function public.read_live_viewer(p_token text)
returns table (
  sport text,
  status text,
  current_state jsonb,
  updated_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_match public.matches%rowtype;
begin
  if p_token is null then
    return;
  end if;

  select m.* into viewer_match
  from public.matches m
  where m.viewer_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and m.viewer_revoked_at is null
    and m.viewer_expires_at > now()
    and (m.expires_at is null or m.expires_at > now())
  limit 1;

  if not found then
    return;
  end if;

  if not private.take_rate_limit(viewer_match.id::text, 'live_viewer_read', 600, 60) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT: live_viewer_read';
  end if;

  return query
  select viewer_match.sport,
         viewer_match.status,
         viewer_match.current_state,
         viewer_match.updated_at,
         viewer_match.viewer_expires_at;
end;
$$;

revoke all on function public.read_live_viewer(text) from public;
grant execute on function public.read_live_viewer(text) to anon, authenticated;

alter table public.community_rule_reports
  drop constraint if exists community_rule_reports_rule_id_fkey;

alter table public.community_rule_reports
  alter column rule_id drop not null,
  add constraint community_rule_reports_rule_id_fkey
    foreign key (rule_id) references public.community_rules(id) on delete set null;

alter table public.community_rule_reports
  add column if not exists reporter_contact text,
  add column if not exists status text not null default 'open',
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text,
  add column if not exists review_notes text;

alter table public.community_rule_reports
  drop constraint if exists community_rule_reports_reason_check,
  drop constraint if exists community_rule_reports_status_check,
  drop constraint if exists community_rule_reports_resolution_check,
  drop constraint if exists community_rule_reports_reporter_contact_check,
  drop constraint if exists community_rule_reports_review_notes_check;

alter table public.community_rule_reports
  add constraint community_rule_reports_reason_check
    check (reason in ('incorrect', 'misleading', 'unsafe', 'spam', 'rights', 'other')),
  add constraint community_rule_reports_status_check
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  add constraint community_rule_reports_resolution_check
    check (resolution is null or resolution in ('no_action', 'requested_edit', 'unpublished', 'removed')),
  add constraint community_rule_reports_reporter_contact_check
    check (
      reporter_contact is null
      or (
        length(reporter_contact) <= 254
        and reporter_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  add constraint community_rule_reports_review_notes_check
    check (review_notes is null or length(review_notes) <= 1000);

create index if not exists community_rule_reports_open_idx
  on public.community_rule_reports (created_at asc)
  where status in ('open', 'reviewing');

create or replace function public.report_community_rule_v2(
  p_rule_id uuid,
  p_reason text,
  p_details text,
  p_reporter_contact text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_id uuid;
  contact text := nullif(trim(coalesce(p_reporter_contact, '')), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED: guest_session';
  end if;
  if p_reason is null or p_reason not in ('incorrect', 'misleading', 'unsafe', 'spam', 'rights', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if length(coalesce(p_details, '')) > 500 then
    raise exception 'Report details must be 500 characters or fewer.';
  end if;
  if contact is not null and (
    length(contact) > 254
    or contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Enter a valid email address or leave it blank.';
  end if;
  if not exists (
    select 1 from public.community_rules r
    where r.id = p_rule_id and r.is_published
  ) then
    raise exception 'Community Rule is unavailable.';
  end if;

  if not private.take_rate_limit(auth.uid()::text, 'community_rule_report', 3, 3600) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT: community_rule_report';
  end if;

  insert into public.community_rule_reports (
    rule_id,
    reporter_id,
    reporter_contact,
    reason,
    details
  ) values (
    p_rule_id,
    auth.uid(),
    contact,
    p_reason,
    coalesce(trim(p_details), '')
  )
  returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.report_community_rule_v2(uuid, text, text, text) from public;
grant execute on function public.report_community_rule_v2(uuid, text, text, text)
  to anon, authenticated;

create or replace function public.report_community_rule(
  p_rule_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.report_community_rule_v2(p_rule_id, p_reason, p_details, null);
$$;

revoke all on function public.report_community_rule(uuid, text, text) from public;
grant execute on function public.report_community_rule(uuid, text, text) to anon, authenticated;

create or replace function public.purge_expired_guest_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_matches integer;
begin
  delete from public.matches
  where is_guest and expires_at <= now();
  get diagnostics deleted_matches = row_count;

  delete from private.action_rate_limits
  where window_started_at < now() - interval '24 hours';

  delete from auth.users
  where is_anonymous is true
    and created_at < now() - interval '30 days';

  return deleted_matches;
end;
$$;

revoke all on function public.purge_expired_guest_matches() from public, anon, authenticated;
grant execute on function public.purge_expired_guest_matches() to service_role;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'purge-expired-guest-data'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'purge-expired-guest-data',
    '0 * * * *',
    'select public.purge_expired_guest_matches();'
  );
end;
$$;

notify pgrst, 'reload schema';

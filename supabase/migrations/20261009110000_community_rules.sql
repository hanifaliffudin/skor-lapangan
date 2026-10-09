create table public.community_rules (
  id uuid primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('badminton', 'pickleball')),
  title text not null check (length(trim(title)) between 3 and 80),
  description text not null default '' check (length(description) <= 500),
  current_version integer not null default 1 check (current_version > 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_rule_versions (
  rule_id uuid not null references public.community_rules(id) on delete cascade,
  version integer not null check (version > 0),
  configuration jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rule_id, version)
);

create table public.community_rule_reports (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.community_rules(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'unsafe', 'misleading', 'other')),
  details text not null default '' check (length(details) <= 500),
  created_at timestamptz not null default now()
);

create index community_rules_public_idx
  on public.community_rules (sport, updated_at desc)
  where is_published;
create index community_rules_author_idx
  on public.community_rules (author_id, updated_at desc);
create index community_rule_reports_rule_idx
  on public.community_rule_reports (rule_id, created_at desc);

create trigger community_rules_set_updated_at
before update on public.community_rules
for each row execute function public.set_updated_at();

alter table public.community_rules enable row level security;
alter table public.community_rule_versions enable row level security;
alter table public.community_rule_reports enable row level security;

revoke all on public.community_rules, public.community_rule_versions, public.community_rule_reports
  from anon, authenticated;
grant select on public.community_rules, public.community_rule_versions to anon, authenticated;

create policy "public_and_owners_read_community_rules"
on public.community_rules
for select
to anon, authenticated
using (
  is_published
  or (select auth.uid()) = author_id
);

create policy "public_and_owners_read_community_rule_versions"
on public.community_rule_versions
for select
to anon, authenticated
using (
  exists (
    select 1 from public.community_rules r
    where r.id = rule_id
      and (r.is_published or r.author_id = (select auth.uid()))
  )
);

create or replace function public.save_community_rule(
  p_rule_id uuid,
  p_expected_version integer,
  p_sport text,
  p_title text,
  p_description text,
  p_configuration jsonb,
  p_is_published boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_version integer;
  next_version integer;
  max_points integer;
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not coalesce(
       ((auth.jwt() -> 'app_metadata' -> 'providers') ? 'google')
       or auth.jwt() -> 'app_metadata' ->> 'provider' = 'google',
       false
     ) then
    raise exception 'A Google-linked account is required to publish Community Rules.';
  end if;
  if p_sport not in ('badminton', 'pickleball') then
    raise exception 'Unsupported sport.';
  end if;
  if p_title is null or length(trim(p_title)) not between 3 and 80 then
    raise exception 'Title must be between 3 and 80 characters.';
  end if;
  if length(coalesce(p_description, '')) > 500 then
    raise exception 'Description must be 500 characters or fewer.';
  end if;
  if coalesce(jsonb_typeof(p_configuration), '') <> 'object'
     or coalesce((p_configuration ->> 'pointsToWin')::integer, 0) not between 1 and 101
     or coalesce((p_configuration ->> 'winBy')::integer, 0) not between 1 and 10
     or coalesce((p_configuration ->> 'bestOf')::integer, 0) not in (1, 3, 5)
     or coalesce(p_configuration ->> 'scoringMode', '') not in ('rally', 'side_out')
     or coalesce((p_configuration ->> 'serversPerTurn')::integer, 0) not in (1, 2)
     or coalesce((p_configuration ->> 'openingServerNumber')::integer, 0) not in (1, 2) then
    raise exception 'Invalid scoring configuration.';
  end if;

  max_points := nullif(p_configuration ->> 'maxPoints', 'null')::integer;
  if max_points is not null and
     (max_points < (p_configuration ->> 'pointsToWin')::integer or max_points > 101) then
    raise exception 'Point cap must be at least the target and no more than 101.';
  end if;

  select r.current_version into existing_version
  from public.community_rules r
  where r.id = p_rule_id and r.author_id = auth.uid()
  for update;

  if found then
    if p_expected_version is distinct from existing_version then
      raise exception 'This rule changed elsewhere. Reload it before saving.';
    end if;
    next_version := existing_version + 1;
    update public.community_rules
    set sport = p_sport,
        title = trim(p_title),
        description = coalesce(trim(p_description), ''),
        current_version = next_version,
        is_published = coalesce(p_is_published, true)
    where id = p_rule_id and author_id = auth.uid();
  else
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception 'This rule no longer exists.';
    end if;
    next_version := 1;
    insert into public.community_rules (
      id, author_id, sport, title, description, current_version, is_published
    ) values (
      p_rule_id, auth.uid(), p_sport, trim(p_title), coalesce(trim(p_description), ''), next_version, coalesce(p_is_published, true)
    );
  end if;

  insert into public.community_rule_versions (rule_id, version, configuration, created_by)
  values (p_rule_id, next_version, p_configuration, auth.uid());

  return next_version;
end;
$$;

revoke all on function public.save_community_rule(uuid, integer, text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.save_community_rule(uuid, integer, text, text, text, jsonb, boolean) to authenticated;

create or replace function public.unpublish_community_rule(p_rule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not coalesce(
       ((auth.jwt() -> 'app_metadata' -> 'providers') ? 'google')
       or auth.jwt() -> 'app_metadata' ->> 'provider' = 'google',
       false
     ) then
    return false;
  end if;
  update public.community_rules
  set is_published = false
  where id = p_rule_id and author_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.unpublish_community_rule(uuid) from public, anon;
grant execute on function public.unpublish_community_rule(uuid) to authenticated;

create or replace function public.report_community_rule(
  p_rule_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_id uuid;
begin
  if p_reason not in ('spam', 'unsafe', 'misleading', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if length(coalesce(p_details, '')) > 500 then
    raise exception 'Report details must be 500 characters or fewer.';
  end if;
  if not exists (
    select 1 from public.community_rules r
    where r.id = p_rule_id and r.is_published
  ) then
    raise exception 'Community Rule is unavailable.';
  end if;

  insert into public.community_rule_reports (rule_id, reporter_id, reason, details)
  values (p_rule_id, auth.uid(), p_reason, coalesce(trim(p_details), ''))
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_community_rule(uuid, text, text) from public;
grant execute on function public.report_community_rule(uuid, text, text) to anon, authenticated;

create or replace function public.can_manage_community_rule(p_rule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_rules r
    where r.id = p_rule_id and r.author_id = auth.uid()
  );
$$;

revoke all on function public.can_manage_community_rule(uuid) from public, anon;
grant execute on function public.can_manage_community_rule(uuid) to authenticated;

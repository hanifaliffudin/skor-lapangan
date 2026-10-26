begin;

-- A durable account is provider-neutral. The application may enable Google,
-- GitHub, Apple, or another Supabase OAuth provider without changing the
-- ownership and moderation boundary.
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
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A durable account is required to claim guest matches.';
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

create or replace function public.transfer_guest_matches(
  p_guest_owner_id uuid,
  p_account_owner_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  transferred_count integer;
  guest_is_anonymous boolean;
  account_is_anonymous boolean;
begin
  if p_guest_owner_id is null
     or p_account_owner_id is null
     or p_guest_owner_id = p_account_owner_id then
    raise exception 'Invalid guest match transfer.';
  end if;

  select u.is_anonymous
  into guest_is_anonymous
  from auth.users u
  where u.id = p_guest_owner_id;

  if not coalesce(guest_is_anonymous, false) then
    raise exception 'The source session is not an anonymous guest.';
  end if;

  select u.is_anonymous
  into account_is_anonymous
  from auth.users u
  where u.id = p_account_owner_id;

  if coalesce(account_is_anonymous, true) then
    raise exception 'A durable account is required for guest match transfer.';
  end if;

  update public.matches
  set owner_id = p_account_owner_id,
      is_guest = false,
      expires_at = null
  where owner_id = p_guest_owner_id
    and is_guest
    and expires_at > now();

  get diagnostics transferred_count = row_count;
  return transferred_count;
end;
$$;

revoke all on function public.transfer_guest_matches(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transfer_guest_matches(uuid, uuid)
  to service_role;

create or replace function public.publish_community_rule(p_rule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $community_rule$
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return false;
  end if;

  update public.community_rules
  set is_published = true
  where id = p_rule_id and author_id = auth.uid();

  return found;
end;
$community_rule$;

revoke all on function public.publish_community_rule(uuid)
  from public, anon;
grant execute on function public.publish_community_rule(uuid)
  to authenticated;

create or replace function public.unpublish_community_rule(p_rule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $community_rule$
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return false;
  end if;

  update public.community_rules
  set is_published = false
  where id = p_rule_id and author_id = auth.uid();

  return found;
end;
$community_rule$;

revoke all on function public.unpublish_community_rule(uuid)
  from public, anon;
grant execute on function public.unpublish_community_rule(uuid)
  to authenticated;

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
as $community_rule$
declare
  existing_version integer;
  next_version integer;
  max_points integer;
  scoring jsonb := p_configuration -> 'scoring';
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A durable account is required to publish Community Rules.';
  end if;

  if p_sport not in (
    'badminton', 'pickleball', 'tennis', 'padel', 'table_tennis', 'squash'
  ) then
    raise exception 'Unsupported sport.';
  end if;
  if p_title is null or length(trim(p_title)) not between 3 and 80 then
    raise exception 'Title must be between 3 and 80 characters.';
  end if;
  if length(coalesce(p_description, '')) > 500 then
    raise exception 'Description must be 500 characters or fewer.';
  end if;
  if coalesce(p_configuration ->> 'schemaVersion', '') <> '2'
     or jsonb_typeof(scoring) <> 'object' then
    raise exception 'Invalid scoring configuration.';
  end if;

  if coalesce(scoring ->> 'pointsToWin', '') !~ '^[0-9]+$'
     or (scoring ->> 'pointsToWin')::integer not between 1 and 101
     or coalesce(scoring ->> 'winBy', '') !~ '^[0-9]+$'
     or (scoring ->> 'winBy')::integer not between 1 and 10 then
    raise exception 'Invalid scoring configuration.';
  end if;
  if scoring -> 'maxPoints' is null then
    raise exception 'Invalid scoring configuration.';
  end if;
  if scoring -> 'maxPoints' <> 'null'::jsonb
     and (
       coalesce(scoring ->> 'maxPoints', '') !~ '^[0-9]+$'
       or (scoring ->> 'maxPoints')::integer not between 1 and 101
     ) then
    raise exception 'Invalid scoring configuration.';
  end if;
  if coalesce(scoring ->> 'bestOf', '') not in ('1', '3', '5')
     or coalesce(scoring ->> 'scoringMode', '') not in ('rally', 'side_out')
     or coalesce(scoring ->> 'serversPerTurn', '') not in ('1', '2')
     or coalesce(scoring ->> 'openingServerNumber', '') not in ('1', '2') then
    raise exception 'Invalid scoring configuration.';
  end if;

  max_points := nullif(scoring ->> 'maxPoints', 'null')::integer;
  if max_points is not null and max_points < (scoring ->> 'pointsToWin')::integer then
    raise exception 'Point cap must be at least the target and no more than 101.';
  end if;

  if p_sport = 'tennis' and (
    jsonb_typeof(p_configuration -> 'tennis') <> 'object'
    or coalesce(p_configuration -> 'tennis' ->> 'bestOf', '') not in ('3', '5')
    or coalesce(p_configuration -> 'tennis' ->> 'gameScoring', '') not in ('advantage', 'no_ad')
    or coalesce(p_configuration -> 'tennis' ->> 'setScoring', '') not in ('tiebreak', 'advantage')
    or coalesce(p_configuration -> 'tennis' ->> 'finalSetScoring', '') not in ('tiebreak', 'advantage', 'match_tiebreak')
    or coalesce(p_configuration -> 'tennis' ->> 'matchTieBreakPoints', '') not in ('7', '10')
  ) then
    raise exception 'Invalid tennis configuration.';
  end if;

  if p_sport = 'padel' and (
    jsonb_typeof(p_configuration -> 'padel') <> 'object'
    or coalesce(p_configuration -> 'padel' ->> 'gameScoring', '') not in ('advantage', 'star_point', 'golden_point')
    or coalesce(p_configuration -> 'padel' ->> 'setScoring', '') not in ('standard', 'mini')
    or coalesce(p_configuration -> 'padel' ->> 'finalSetScoring', '') not in ('standard', 'advantage', 'match_tiebreak')
    or coalesce(p_configuration -> 'padel' ->> 'matchTieBreakPoints', '') not in ('7', '10')
  ) then
    raise exception 'Invalid padel configuration.';
  end if;

  if p_sport = 'table_tennis' and (
    jsonb_typeof(p_configuration -> 'tableTennis') <> 'object'
    or coalesce(p_configuration -> 'tableTennis' ->> 'bestOf', '') not in ('3', '5')
  ) then
    raise exception 'Invalid table tennis configuration.';
  end if;

  if p_sport = 'squash' and (
    jsonb_typeof(p_configuration -> 'squash') <> 'object'
    or coalesce(p_configuration -> 'squash' ->> 'bestOf', '') not in ('3', '5')
  ) then
    raise exception 'Invalid squash configuration.';
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
      p_rule_id, auth.uid(), p_sport, trim(p_title),
      coalesce(trim(p_description), ''), next_version,
      coalesce(p_is_published, true)
    );
  end if;

  insert into public.community_rule_versions (rule_id, version, configuration, created_by)
  values (p_rule_id, next_version, p_configuration, auth.uid());

  return next_version;
end;
$community_rule$;

revoke all on function public.save_community_rule(uuid, integer, text, text, text, jsonb, boolean)
  from public, anon;
grant execute on function public.save_community_rule(uuid, integer, text, text, text, jsonb, boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;

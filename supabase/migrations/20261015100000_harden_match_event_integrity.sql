begin;

create or replace function private.validate_match_event_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_sequence bigint;
  match_sport text;
begin
  select m.last_client_sequence, m.sport
  into match_sequence, match_sport
  from public.matches as m
  where m.id = new.match_id
    and m.owner_id = new.owner_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Match event owner or match does not exist.';
  end if;

  if new.client_sequence > match_sequence then
    raise exception using
      errcode = '23514',
      message = 'Match event sequence exceeds the match snapshot.';
  end if;

  if new.event_type like 'tennis_%' and match_sport <> 'tennis' then
    raise exception using
      errcode = '23514',
      message = 'Tennis events require a Tennis match.';
  end if;
  if new.event_type like 'padel_%' and match_sport <> 'padel' then
    raise exception using
      errcode = '23514',
      message = 'Padel events require a Padel match.';
  end if;
  if new.event_type = 'table_tennis_game_orders_confirmed'
     and match_sport <> 'table_tennis' then
    raise exception using
      errcode = '23514',
      message = 'Table tennis events require a Table tennis match.';
  end if;
  if new.event_type like 'squash_%' and match_sport <> 'squash' then
    raise exception using
      errcode = '23514',
      message = 'Squash events require a Squash match.';
  end if;

  if exists (
    select 1
    from public.match_events as e
    where e.id = new.id
      and (
        e.match_id is distinct from new.match_id
        or e.owner_id is distinct from new.owner_id
        or e.client_sequence is distinct from new.client_sequence
        or e.event_type is distinct from new.event_type
        or e.payload is distinct from new.payload
        or e.created_at is distinct from new.created_at
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'A match event ID cannot be reused with different data.';
  end if;

  if exists (
    select 1
    from public.match_events as e
    where e.match_id = new.match_id
      and e.owner_id = new.owner_id
      and e.client_sequence = new.client_sequence
      and e.id <> new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A match event sequence cannot be reused with a different ID.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_match_event_integrity()
  from public, anon, authenticated;

drop trigger if exists zz_match_events_validate_integrity on public.match_events;
create trigger zz_match_events_validate_integrity
before insert on public.match_events
for each row execute function private.validate_match_event_integrity();

create or replace function private.assert_match_event_journal_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_count bigint;
begin
  select count(*)
  into event_count
  from public.match_events as e
  where e.match_id = new.id
    and e.owner_id = new.owner_id;

  if event_count <> new.last_client_sequence then
    raise exception using
      errcode = '23514',
      message = 'Match event journal is incomplete.';
  end if;

  return new;
end;
$$;

revoke all on function private.assert_match_event_journal_complete()
  from public, anon, authenticated;

drop trigger if exists matches_assert_event_journal_complete on public.matches;
create constraint trigger matches_assert_event_journal_complete
after insert or update of last_client_sequence on public.matches
deferrable initially deferred
for each row execute function private.assert_match_event_journal_complete();

notify pgrst, 'reload schema';
commit;

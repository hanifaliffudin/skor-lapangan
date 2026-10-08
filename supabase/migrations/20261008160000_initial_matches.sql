create table public.matches (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sport text not null check (sport in ('badminton', 'pickleball')),
  ruleset_id text not null,
  mode text not null check (mode in ('casual', 'referee')),
  definition jsonb not null,
  status text not null check (status in ('active', 'complete')),
  winner text check (winner is null or winner in ('A', 'B')),
  current_state jsonb not null,
  last_client_sequence bigint not null default 0 check (last_client_sequence >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.match_events (
  id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_sequence bigint not null check (client_sequence > 0),
  event_type text not null check (
    event_type in ('rally_awarded', 'state_overridden', 'undo_applied', 'redo_applied')
  ),
  payload jsonb not null,
  created_at timestamptz not null,
  unique (match_id, client_sequence)
);

create index matches_owner_id_idx on public.matches using btree (owner_id);
create index matches_owner_updated_idx on public.matches using btree (owner_id, updated_at desc);
create index match_events_owner_id_idx on public.match_events using btree (owner_id);
create index match_events_match_sequence_idx on public.match_events using btree (match_id, client_sequence);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create function public.prevent_match_state_regression()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.last_client_sequence < old.last_client_sequence then
    return old;
  end if;
  return new;
end;
$$;

create trigger zz_matches_prevent_state_regression
before update on public.matches
for each row execute function public.prevent_match_state_regression();

alter table public.matches enable row level security;
alter table public.match_events enable row level security;

revoke all on table public.matches from anon, authenticated;
revoke all on table public.match_events from anon, authenticated;

grant select, insert, update, delete on table public.matches to authenticated;
grant select, insert on table public.match_events to authenticated;

create policy "owners_select_matches"
on public.matches
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners_insert_matches"
on public.matches
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "owners_update_matches"
on public.matches
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "owners_delete_matches"
on public.matches
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners_select_match_events"
on public.match_events
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners_insert_match_events"
on public.match_events
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.matches
    where matches.id = match_events.match_id
      and matches.owner_id = (select auth.uid())
  )
);

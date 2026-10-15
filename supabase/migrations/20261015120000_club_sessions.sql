begin;

create table public.club_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  session_date date not null,
  sport text not null default 'badminton' check (sport = 'badminton'),
  format text not null default 'doubles' check (format = 'doubles'),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.club_session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, session_id, owner_id),
  foreign key (session_id, owner_id)
    references public.club_sessions(id, owner_id)
    on delete cascade
);

create table public.club_session_courts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, session_id, owner_id),
  foreign key (session_id, owner_id)
    references public.club_sessions(id, owner_id)
    on delete cascade
);

create table public.club_session_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null unique,
  linked_match_id uuid unique,
  court_id uuid not null,
  team_a_player_1 uuid not null,
  team_a_player_2 uuid not null,
  team_b_player_1 uuid not null,
  team_b_player_2 uuid not null,
  queue_order integer not null check (queue_order >= 0),
  started_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (session_id, owner_id)
    references public.club_sessions(id, owner_id)
    on delete cascade,
  foreign key (court_id, session_id, owner_id)
    references public.club_session_courts(id, session_id, owner_id)
    on delete no action deferrable initially deferred,
  foreign key (team_a_player_1, session_id, owner_id)
    references public.club_session_players(id, session_id, owner_id)
    on delete no action deferrable initially deferred,
  foreign key (team_a_player_2, session_id, owner_id)
    references public.club_session_players(id, session_id, owner_id)
    on delete no action deferrable initially deferred,
  foreign key (team_b_player_1, session_id, owner_id)
    references public.club_session_players(id, session_id, owner_id)
    on delete no action deferrable initially deferred,
  foreign key (team_b_player_2, session_id, owner_id)
    references public.club_session_players(id, session_id, owner_id)
    on delete no action deferrable initially deferred,
  foreign key (linked_match_id, owner_id)
    references public.matches(id, owner_id)
    on delete cascade,
  check (
    team_a_player_1 <> team_a_player_2
    and team_a_player_1 <> team_b_player_1
    and team_a_player_1 <> team_b_player_2
    and team_a_player_2 <> team_b_player_1
    and team_a_player_2 <> team_b_player_2
    and team_b_player_1 <> team_b_player_2
  )
);

create unique index club_session_players_active_name_idx
  on public.club_session_players(session_id, lower(btrim(display_name)))
  where is_active;
create unique index club_session_courts_active_name_idx
  on public.club_session_courts(session_id, lower(btrim(name)))
  where is_active;
create index club_sessions_owner_date_idx
  on public.club_sessions(owner_id, session_date desc, created_at desc);
create index club_session_players_order_idx
  on public.club_session_players(session_id, sort_order, created_at);
create index club_session_courts_order_idx
  on public.club_session_courts(session_id, sort_order, created_at);
create index club_session_matches_queue_idx
  on public.club_session_matches(session_id, queue_order, created_at);

create trigger club_sessions_set_updated_at
before update on public.club_sessions
for each row execute function public.set_updated_at();

create function public.attach_club_session_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.club_session_matches
  set linked_match_id = new.id
  where match_id = new.id
    and owner_id = new.owner_id
    and linked_match_id is null;
  return new;
end;
$$;

create trigger matches_attach_club_session_match
after insert on public.matches
for each row execute function public.attach_club_session_match();

revoke all on function public.attach_club_session_match() from public, anon, authenticated;

alter table public.club_sessions enable row level security;
alter table public.club_session_players enable row level security;
alter table public.club_session_courts enable row level security;
alter table public.club_session_matches enable row level security;

revoke all on table public.club_sessions from anon, authenticated;
revoke all on table public.club_session_players from anon, authenticated;
revoke all on table public.club_session_courts from anon, authenticated;
revoke all on table public.club_session_matches from anon, authenticated;

grant select, insert, update, delete on table public.club_sessions to authenticated;
grant select, insert, update, delete on table public.club_session_players to authenticated;
grant select, insert, update, delete on table public.club_session_courts to authenticated;
grant select, insert, update, delete on table public.club_session_matches to authenticated;

create policy "account_owners_manage_club_sessions"
on public.club_sessions
for all to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

create policy "account_owners_manage_club_session_players"
on public.club_session_players
for all to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

create policy "account_owners_manage_club_session_courts"
on public.club_session_courts
for all to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

create policy "account_owners_manage_club_session_matches"
on public.club_session_matches
for all to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

notify pgrst, 'reload schema';

commit;

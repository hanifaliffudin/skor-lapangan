begin;

alter table public.club_sessions
  add column if not exists play_profile text;

update public.club_sessions
set play_profile = case
  when sport = 'table_tennis' then 'table_tennis_singles_short'
  when sport = 'squash' then 'squash_singles'
  else sport || '_doubles'
end
where play_profile is null;

alter table public.club_sessions
  drop constraint if exists club_sessions_format_check;

update public.club_sessions
set format = case
  when sport in ('table_tennis', 'squash') then 'singles'
  else 'doubles'
end;

alter table public.club_sessions
  alter column play_profile set default 'badminton_doubles',
  alter column play_profile set not null;

alter table public.club_sessions
  alter column play_profile drop default,
  alter column format drop default;

create or replace function public.set_club_session_play_profile_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.play_profile is null then
    new.play_profile := case
      when new.sport = 'table_tennis' then 'table_tennis_singles_short'
      when new.sport = 'squash' then 'squash_singles'
      else new.sport || '_doubles'
    end;
  end if;

  if new.format is null then
    new.format := case
      when new.play_profile in ('table_tennis_singles_short', 'squash_singles')
        then 'singles'
      else 'doubles'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists club_sessions_set_play_profile_defaults
on public.club_sessions;
create trigger club_sessions_set_play_profile_defaults
before insert on public.club_sessions
for each row execute function public.set_club_session_play_profile_defaults();

alter table public.club_sessions
  drop constraint if exists club_sessions_format_check,
  add constraint club_sessions_format_check
    check (format in ('singles', 'doubles')),
  add constraint club_sessions_play_profile_check
    check (play_profile in (
      'badminton_doubles',
      'pickleball_doubles',
      'tennis_doubles',
      'padel_doubles',
      'table_tennis_singles_short',
      'squash_singles'
    )),
  add constraint club_sessions_play_profile_sport_check
    check (
      (sport = 'badminton' and play_profile = 'badminton_doubles')
      or (sport = 'pickleball' and play_profile = 'pickleball_doubles')
      or (sport = 'tennis' and play_profile = 'tennis_doubles')
      or (sport = 'padel' and play_profile = 'padel_doubles')
      or (sport = 'table_tennis' and play_profile = 'table_tennis_singles_short')
      or (sport = 'squash' and play_profile = 'squash_singles')
    ),
  add constraint club_sessions_play_profile_format_check
    check (
      (play_profile in ('table_tennis_singles_short', 'squash_singles')
        and format = 'singles')
      or (play_profile not in ('table_tennis_singles_short', 'squash_singles')
        and format = 'doubles')
    );

alter table public.club_session_matches
  alter column team_a_player_2 drop not null,
  alter column team_b_player_2 drop not null;

alter table public.club_session_matches
  drop constraint if exists club_session_matches_check,
  add constraint club_session_matches_unique_players_check
    check (
      team_a_player_1 is not null
      and team_b_player_1 is not null
      and team_a_player_1 is distinct from team_a_player_2
      and team_a_player_1 is distinct from team_b_player_1
      and team_a_player_1 is distinct from team_b_player_2
      and team_a_player_2 is distinct from team_b_player_1
      and team_a_player_2 is distinct from team_b_player_2
      and team_b_player_1 is distinct from team_b_player_2
    );

notify pgrst, 'reload schema';
commit;

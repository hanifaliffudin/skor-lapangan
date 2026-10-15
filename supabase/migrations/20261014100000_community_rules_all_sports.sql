alter table public.community_rules
  drop constraint if exists community_rules_sport_check;

alter table public.community_rules
  add constraint community_rules_sport_check
  check (sport in (
    'badminton',
    'pickleball',
    'tennis',
    'padel',
    'table_tennis',
    'squash'
  ));

update public.community_rule_versions as v
set configuration = jsonb_build_object(
  'schemaVersion', 2,
  'scoring', v.configuration
)
from public.community_rules as r
where r.id = v.rule_id
  and r.sport in ('badminton', 'pickleball', 'tennis', 'padel', 'table_tennis', 'squash')
  and (v.configuration ->> 'schemaVersion') is distinct from '2';

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
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not coalesce(
       ((auth.jwt() -> 'app_metadata' -> 'providers') ? 'google')
       or auth.jwt() -> 'app_metadata' ->> 'provider' = 'google',
       false
     ) then
    raise exception 'A Google-linked account is required to publish Community Rules.';
  end if;

  if p_sport not in (
    'badminton',
    'pickleball',
    'tennis',
    'padel',
    'table_tennis',
    'squash'
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
     or (scoring ->> 'pointsToWin')::integer not between 1 and 101 then
    raise exception 'Invalid scoring configuration.';
  end if;
  if coalesce(scoring ->> 'winBy', '') !~ '^[0-9]+$'
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
      p_rule_id,
      auth.uid(),
      p_sport,
      trim(p_title),
      coalesce(trim(p_description), ''),
      next_version,
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

create or replace function public.sanitize_guest_match_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guest_payload$
declare
  completed_games jsonb;
  community_ruleset jsonb;
begin
  if not new.is_guest then
    return new;
  end if;

  community_ruleset := case
    when new.definition -> 'ruleset' ->> 'source' = 'community' then
      jsonb_strip_nulls(jsonb_build_object(
        'id', new.definition -> 'ruleset' -> 'id',
        'name', new.definition -> 'ruleset' -> 'name',
        'sport', new.definition -> 'ruleset' -> 'sport',
        'format', new.definition -> 'ruleset' -> 'format',
        'source', new.definition -> 'ruleset' -> 'source',
        'version', new.definition -> 'ruleset' -> 'version',
        'configuration', new.definition -> 'ruleset' -> 'configuration',
        'tennisConfiguration', new.definition -> 'ruleset' -> 'tennisConfiguration',
        'padelConfiguration', new.definition -> 'ruleset' -> 'padelConfiguration',
        'tableTennisConfiguration', new.definition -> 'ruleset' -> 'tableTennisConfiguration',
        'squashConfiguration', new.definition -> 'ruleset' -> 'squashConfiguration'
      ))
    else null
  end;

  new.definition := jsonb_strip_nulls(jsonb_build_object(
    'id', new.definition -> 'id',
    'sport', new.definition -> 'sport',
    'format', case
      when new.definition ->> 'format' in ('singles', 'doubles')
        then new.definition -> 'format'
      else '"doubles"'::jsonb
    end,
    'rulesetId', new.definition -> 'rulesetId',
    'ruleset', community_ruleset,
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
    'format', case
      when new.current_state ->> 'format' in ('singles', 'doubles')
        then new.current_state -> 'format'
      else '"doubles"'::jsonb
    end,
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
$guest_payload$;

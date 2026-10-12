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
    'format', case
      when new.definition ->> 'format' in ('singles', 'doubles')
        then new.definition -> 'format'
      else '"doubles"'::jsonb
    end,
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
$$;

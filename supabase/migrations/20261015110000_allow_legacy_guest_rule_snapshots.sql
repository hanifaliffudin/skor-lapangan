begin;

create or replace function private.validate_ruleset_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $ruleset_source_compatibility$
declare
  source_name text;
begin
  if new.sport not in (
    'badminton',
    'pickleball',
    'tennis',
    'padel',
    'table_tennis',
    'squash'
  ) then
    return new;
  end if;

  source_name := coalesce(new.definition #>> '{ruleset,source}', '');
  if source_name = '' and new.is_guest then
    return new;
  end if;
  if source_name not in ('official', 'local_variant', 'community') then
    raise exception 'Match rules snapshot source is invalid.';
  end if;
  return new;
end;
$ruleset_source_compatibility$;

revoke all on function private.validate_ruleset_source() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;

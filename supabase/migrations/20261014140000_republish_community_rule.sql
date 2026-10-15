create or replace function public.publish_community_rule(p_rule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $community_rule$
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
  set is_published = true
  where id = p_rule_id and author_id = auth.uid();

  return found;
end;
$community_rule$;

revoke all on function public.publish_community_rule(uuid)
  from public, anon;
grant execute on function public.publish_community_rule(uuid)
  to authenticated;

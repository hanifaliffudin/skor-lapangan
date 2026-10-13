create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  delete from private.action_rate_limits
  where actor_key = auth.uid()::text;

  delete from public.community_rule_reports
  where reporter_id = auth.uid();

  delete from public.matches
  where owner_id = auth.uid();

  delete from public.community_rule_versions
  where created_by = auth.uid();

  delete from public.community_rules
  where author_id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account_data() from public, anon;
grant execute on function public.delete_my_account_data() to authenticated;

alter table public.match_events
  drop constraint if exists match_events_match_id_owner_id_fkey;

alter table public.match_events
  add constraint match_events_match_id_owner_id_fkey
  foreign key (match_id, owner_id)
  references public.matches(id, owner_id)
  on update cascade
  on delete cascade;

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
  guest_provider text;
  account_has_google boolean;
begin
  if p_guest_owner_id is null
     or p_account_owner_id is null
     or p_guest_owner_id = p_account_owner_id then
    raise exception 'Invalid guest match transfer.';
  end if;

  select u.raw_app_meta_data ->> 'provider'
  into guest_provider
  from auth.users u
  where u.id = p_guest_owner_id;

  if guest_provider is distinct from 'anonymous' then
    raise exception 'The source session is not an anonymous guest.';
  end if;

  select coalesce(
    (u.raw_app_meta_data -> 'providers') ? 'google'
      or u.raw_app_meta_data ->> 'provider' = 'google',
    false
  )
  into account_has_google
  from auth.users u
  where u.id = p_account_owner_id;

  if not coalesce(account_has_google, false) then
    raise exception 'The destination account is not linked to Google.';
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

revoke all on function public.transfer_guest_matches(uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_guest_matches(uuid, uuid) to service_role;

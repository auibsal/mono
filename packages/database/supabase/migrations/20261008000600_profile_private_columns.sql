-- Verified members may read each other's profiles (names, bios, avatars),
-- but not the private columns: the personal email ("never shown publicly")
-- and the email preference. Column privileges hide them from every client;
-- a member reads their own through core.my_private_profile(). The service
-- role (apps/api: emails, exports) is unaffected.
revoke select on core.profiles from authenticated;
grant select (id, full_name_en, full_name_ar, bio, avatar_path, locale,
  camera_shy, setup_completed_at, verified_at, created_at, updated_at)
  on core.profiles to authenticated;

create function core.my_private_profile()
returns table (personal_email text, notify_email boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.personal_email, p.notify_email from core.profiles p where p.id = auth.uid();
$$;

revoke all on function core.my_private_profile() from public, anon;
grant execute on function core.my_private_profile() to authenticated, service_role;

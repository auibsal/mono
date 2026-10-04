-- File storage with tenant isolation.
--
-- org-files (private): objects live under "<organization_id>/…"; members of
--   that organization can read and write them.
-- avatars (public read): objects live under "<user_id>/…"; only that user
--   can write them.

-- Returns null instead of raising for paths that don't start with a UUID.
create function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

grant execute on function private.try_uuid(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('org-files', 'org-files', false, 52428800),
  ('avatars', 'avatars', true, 2097152)
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';

create policy "Members read their organization's files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'org-files'
    and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Members upload their organization's files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'org-files'
    and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Members update their organization's files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'org-files'
    and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'org-files'
    and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Members delete their organization's files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-files'
    and private.is_org_member(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

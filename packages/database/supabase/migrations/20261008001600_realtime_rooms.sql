-- Live co-editing on Supabase Realtime (replacing Liveblocks). A room is a
-- private Realtime channel named `sal:<kind>:<uuid>` after the record being
-- edited (packages/collaboration/rooms.ts lists the kinds). Realtime checks
-- these policies on realtime.messages when someone joins a private channel
-- or sends to it: only people who may edit the record get in, at the same
-- permission and scope apps/api used to check before issuing Liveblocks
-- tokens. Third-party app tokens never join.
--
-- Turn off "Allow public access" in Dashboard → Realtime → Settings, so no
-- channel can be joined without these checks.

create function private.can_edit_room(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := regexp_match(
    topic,
    '^sal:([a-z]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  );
  kind text := parts[1];
  record_id uuid := parts[2]::uuid;
  issue uuid;
begin
  if parts is null or (select private.oauth_client_id()) is not null then
    return false;
  end if;
  case kind
    when 'minutes' then
      return exists (select 1 from governance.minutes m where m.id = record_id)
        and access.has_permission('governance.minutes.write');
    when 'news' then
      return exists (select 1 from content.news_posts n where n.id = record_id)
        and access.has_permission('content.manage');
    when 'page' then
      return exists (select 1 from content.pages p where p.id = record_id)
        and access.has_permission('content.manage');
    when 'piece' then
      select p.issue_id into issue from journal.pieces p where p.id = record_id;
      return issue is not null
        and access.has_permission('journal.publish', 'issue', issue);
    else
      return false;
  end case;
end;
$$;

grant execute on function private.can_edit_room(text) to authenticated;

create policy "Editors receive their record's room"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.can_edit_room(realtime.topic()))
  );

create policy "Editors send to their record's room"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.can_edit_room(realtime.topic()))
  );

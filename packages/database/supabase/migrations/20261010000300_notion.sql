-- The team's Notion workspace (owner's decision, Oct 10, 2026). Team work
-- (projects, tasks, meetings, planning, the handbook) lives in Notion;
-- events and news are written there and published by apps/api after a
-- permission check against this database. Notion receives read-only copies
-- of the officer directory, programs, the document and minutes registry and
-- Journal stage counts. Nothing private crosses: no member records, RSVPs
-- by name, ballots, submissions or authors, ledger entries or certificates.
--
-- apps/api (/cron/notion-sync, every five minutes) does the work with the
-- NOTION_TOKEN secret; without it the job does nothing.

-- Which Nexus record each Notion page stands for.
create table core.notion_links (
  notion_page_id text primary key check (notion_page_id ~ '^[0-9a-f]{32}$'),
  kind text not null check (
    kind in ('event', 'news', 'officer', 'programme', 'document', 'minutes', 'journal_stage')
  ),
  -- The Nexus row's id, or "<call id>:<stage>" for Journal counts.
  record_key text not null check (char_length(record_key) between 1 and 120),
  -- Hash of what was last written to (or read from) Notion, to skip
  -- unchanged rows.
  content_hash text check (char_length(content_hash) <= 128),
  synced_at timestamptz not null default now(),
  unique (kind, record_key)
);

comment on table core.notion_links is
  'Which Nexus record each page in the team''s Notion workspace stands for (apps/api Notion sync).';

alter table core.notion_links enable row level security;

-- Officers who manage what a page holds may see the link ("Open in Notion").
create policy "Officers see Notion links"
  on core.notion_links for select to authenticated
  using (
    (select access.has_permission_anywhere('events.manage'))
    or (select access.has_permission_anywhere('content.manage'))
    or (select access.has_permission_anywhere('settings.manage'))
    or (select access.has_permission_anywhere('governance.manage'))
  );

create policy "Third-party apps reach only their areas"
  on core.notion_links as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select on core.notion_links to authenticated;
grant all on core.notion_links to service_role;

-- The workspace's databases (Notion data source ids; not secrets). The home
-- page is linked from the Nexus Account menu for officers.
insert into core.settings (key, value, is_public, description) values
  ('notion.data_sources', jsonb_build_object(
    'officers', 'de1885b4-57e9-4dd7-b746-f230d173f0dd',
    'programmes', '12c979ef-9364-47e2-ae03-d41d53bd6203',
    'documents', 'f584e083-0670-467d-ae69-2002e391ff69',
    'journal', 'ee0beaa9-12b7-430f-9e44-e335d9c27f31',
    'events', '03e069a1-bb58-4e06-adeb-fb0b873cead8',
    'news', '80ea1cda-0bec-42d8-adab-df1676652ece'
  ), false, 'Notion data sources the platform syncs with (Start here → From the Nexus, Publishing).'),
  ('notion.home_url', to_jsonb('https://app.notion.com/p/d728824068868397a2d9817f6f31f8fe'::text), true,
    'The team workspace''s Start here page, linked for officers.'),
  ('notion.sync_state', 'null', false, 'Written by apps/api after each Notion sync: when, counts and problems.')
on conflict (key) do nothing;

-- Who may publish from Notion. The Notion page records its last editor; the
-- platform matches that person by email and asks whether they hold the
-- permission (for the scope, if given). Roles that need two-step sign-in
-- count only when the account has a verified second factor, since a Notion
-- session is not one of ours. Service role only.
create function access.notion_publisher(
  email text,
  permission text,
  scope_type text default 'global',
  scope_id uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(notion_publisher.email)
    and exists (
      select 1
      from access.role_assignments a
      join access.role_permissions rp on rp.role = a.role
      join access.roles r on r.key = a.role
      where a.user_id = u.id
        and rp.permission = notion_publisher.permission
        and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
        and (
          a.scope_type = 'global'
          or (a.scope_type = notion_publisher.scope_type
            and a.scope_id = notion_publisher.scope_id)
        )
        and (
          not r.requires_mfa
          or exists (
            select 1 from auth.mfa_factors f
            where f.user_id = u.id and f.status = 'verified'
          )
        )
    )
  limit 1;
$$;

revoke all on function access.notion_publisher(text, text, text, uuid) from public, anon, authenticated;
grant execute on function access.notion_publisher(text, text, text, uuid) to service_role;

-- The officer directory copied to Notion: everyone holding a role now,
-- with their AUIB address so Notion can match the person. Service role only.
create function access.officer_directory()
returns table (
  user_id uuid,
  email text,
  full_name_en text,
  full_name_ar text,
  roles text[],
  council boolean,
  term_starts timestamptz,
  term_ends timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.user_id,
    u.email::text,
    p.full_name_en,
    p.full_name_ar,
    array_agg(distinct r.name_en order by r.name_en),
    bool_or(r.is_council),
    min(a.starts_at),
    case when bool_or(a.ends_at is null) then null else max(a.ends_at) end
  from access.role_assignments a
  join access.roles r on r.key = a.role
  join auth.users u on u.id = a.user_id
  left join core.profiles p on p.id = a.user_id
  where a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now())
  group by a.user_id, u.email, p.full_name_en, p.full_name_ar;
$$;

revoke all on function access.officer_directory() from public, anon, authenticated;
grant execute on function access.officer_directory() to service_role;

select cron.schedule('sal-notion-sync', '*/5 * * * *',
  $$ select private.call_api('/cron/notion-sync', '{}'::jsonb, 'cron_secret') $$);

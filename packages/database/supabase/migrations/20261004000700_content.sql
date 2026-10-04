-- Content: simple pages, news, the media library, homepage slots,
-- announcements, the document search index, and published-only search.

create schema content;
grant usage on schema content to anon, authenticated, service_role;

create table content.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
  title_en text not null,
  title_ar text not null,
  body_en text,
  body_ar text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on content.pages
  for each row execute function private.set_updated_at();

create table content.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_ar text not null,
  excerpt_en text check (char_length(excerpt_en) <= 400),
  excerpt_ar text check (char_length(excerpt_ar) <= 400),
  -- Sanitised HTML (on save and on render).
  body_en text,
  body_ar text,
  cover_path text,
  programme_id uuid references core.programmes (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  published_at timestamptz,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_posts_published_idx on content.news_posts (status, published_at desc);
create index news_posts_programme_id_idx on content.news_posts (programme_id);

create trigger set_updated_at before update on content.news_posts
  for each row execute function private.set_updated_at();

create table content.media_assets (
  id uuid primary key default gen_random_uuid(),
  -- Public `media` bucket.
  storage_path text not null unique,
  mime_type text not null,
  alt_en text not null default '',
  alt_ar text not null default '',
  width integer,
  height integer,
  -- Photo policy: consent recorded for every identifiable person.
  consent_note text,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table content.homepage_slots (
  key text primary key check (key ~ '^[a-z_]+$'),
  ref_type text check (ref_type in ('event', 'piece', 'issue', 'news', 'campaign', 'call', 'page')),
  ref_id uuid,
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  link text,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on content.homepage_slots
  for each row execute function private.set_updated_at();

create table content.announcements (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ar text not null,
  body_en text,
  body_ar text,
  link text,
  audience text not null default 'members' check (audience in ('public', 'members')),
  -- Site-wide banner (public audience only).
  is_banner boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (not is_banner or audience = 'public'),
  check (ends_at is null or ends_at > starts_at)
);

create index announcements_window_idx on content.announcements (starts_at, ends_at);

-- Sections of the public document pages (MDX in apps/web), indexed by the
-- web build through apps/api so /search covers them.
create table content.document_sections (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  locale text not null check (locale in ('en', 'ar')),
  path text not null,
  anchor text not null default '',
  title text not null,
  body text not null,
  status text not null check (status in ('draft', 'adopted', 'superseded')),
  updated_at timestamptz not null default now(),
  unique (code, locale, anchor)
);

-- ── Search ──────────────────────────────────────────────────────────────────

-- Unaccented, unstemmed ('simple') search across both languages: Arabic has
-- no built-in stemmer, and mixed-language pages are common.
create function private.search_vector(variadic parts text[])
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select to_tsvector('simple'::regconfig, coalesce(array_to_string(parts, ' '), ''));
$$;

alter table events.events add column search tsvector generated always as (
  private.search_vector(title_en, title_ar, summary_en, summary_ar, venue_en, venue_ar)
) stored;
create index events_search_idx on events.events using gin (search);

alter table content.news_posts add column search tsvector generated always as (
  private.search_vector(title_en, title_ar, excerpt_en, excerpt_ar,
    regexp_replace(coalesce(body_en, ''), '<[^>]+>', ' ', 'g'),
    regexp_replace(coalesce(body_ar, ''), '<[^>]+>', ' ', 'g'))
) stored;
create index news_posts_search_idx on content.news_posts using gin (search);

alter table journal.pieces add column search tsvector generated always as (
  private.search_vector(title_en, title_ar, credit_en, credit_ar)
) stored;
create index pieces_search_idx on journal.pieces using gin (search);

alter table content.document_sections add column search tsvector generated always as (
  private.search_vector(title, body)
) stored;
create index document_sections_search_idx on content.document_sections using gin (search);

-- Published, public items only, whoever asks: members-only events and
-- members-only piece text never appear here.
create function content.search(query text, max_results integer default 30)
returns table (
  kind text,
  id uuid,
  slug text,
  title_en text,
  title_ar text,
  snippet text,
  occurred_at timestamptz,
  rank real
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('simple'::regconfig, left(coalesce(query, ''), 200)) as tsq
  )
  select * from (
    select 'event'::text, e.id, e.slug, e.title_en, e.title_ar,
      coalesce(e.summary_en, e.summary_ar), e.starts_at, ts_rank(e.search, q.tsq)
    from events.events e, q
    where e.search @@ q.tsq and e.status = 'published' and not e.members_only
    union all
    select 'news', n.id, n.slug, n.title_en, n.title_ar,
      coalesce(n.excerpt_en, n.excerpt_ar), n.published_at, ts_rank(n.search, q.tsq)
    from content.news_posts n, q
    where n.search @@ q.tsq and n.status = 'published' and n.published_at <= now()
    union all
    select 'piece', p.id, p.slug, p.title_en, p.title_ar,
      null, p.published_at, ts_rank(p.search, q.tsq)
    from journal.pieces p, q
    where p.search @@ q.tsq and p.status = 'published' and p.published_at <= now()
    union all
    select 'document', d.id, d.path || case when d.anchor = '' then '' else '#' || d.anchor end,
      case when d.locale = 'en' then d.title end,
      case when d.locale = 'ar' then d.title end,
      left(d.body, 240), d.updated_at, ts_rank(d.search, q.tsq)
    from content.document_sections d, q
    where d.search @@ q.tsq
  ) results (kind, id, slug, title_en, title_ar, snippet, occurred_at, rank)
  where char_length(btrim(coalesce(query, ''))) >= 2
  order by rank desc, occurred_at desc nulls last
  limit least(greatest(max_results, 1), 50);
$$;

-- ── Public read helpers ─────────────────────────────────────────────────────

-- The Six Words wall: approved pieces, with the author's name when they chose.
create function programmes.six_words_wall(max_results integer default 200)
returns table (id uuid, text text, language text, author_en text, author_ar text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.text, w.language,
    case when w.show_name then p.full_name_en end,
    case when w.show_name then p.full_name_ar end,
    w.created_at
  from programmes.six_words w
  join core.profiles p on p.id = w.user_id
  where w.status = 'approved'
  order by w.created_at desc
  limit least(greatest(max_results, 1), 500);
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table content.pages enable row level security;
alter table content.news_posts enable row level security;
alter table content.media_assets enable row level security;
alter table content.homepage_slots enable row level security;
alter table content.announcements enable row level security;
alter table content.document_sections enable row level security;

create policy "Anyone reads published pages"
  on content.pages for select to anon, authenticated using (status = 'published');
create policy "Content managers manage pages"
  on content.pages for all to authenticated
  using ((select access.has_permission('content.manage')))
  with check ((select access.has_permission('content.manage')));

create policy "Anyone reads published news"
  on content.news_posts for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy "Content managers manage news"
  on content.news_posts for all to authenticated
  using ((select access.has_permission('content.manage')))
  with check ((select access.has_permission('content.manage')));

create policy "Anyone reads media metadata"
  on content.media_assets for select to anon, authenticated using (true);
create policy "Content managers manage media"
  on content.media_assets for all to authenticated
  using ((select access.has_permission_anywhere('content.manage')))
  with check ((select access.has_permission_anywhere('content.manage')));

create policy "Anyone reads homepage slots"
  on content.homepage_slots for select to anon, authenticated using (true);
create policy "Content managers manage homepage slots"
  on content.homepage_slots for all to authenticated
  using ((select access.has_permission('content.manage')))
  with check ((select access.has_permission('content.manage')));

create policy "Anyone reads current public announcements"
  on content.announcements for select to anon, authenticated
  using (audience = 'public' and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "Members read current member announcements"
  on content.announcements for select to authenticated
  using (
    audience = 'members' and starts_at <= now() and (ends_at is null or ends_at > now())
    and (select membership.is_member())
  );
create policy "Content managers manage announcements"
  on content.announcements for all to authenticated
  using ((select access.has_permission('content.manage')))
  with check ((select access.has_permission('content.manage')));

create policy "Anyone reads indexed document sections"
  on content.document_sections for select to anon, authenticated using (true);
-- Written by apps/api (service role) from the web build.

revoke all on all tables in schema content from anon, authenticated;
revoke all on all functions in schema content from public, anon, authenticated;

grant select on all tables in schema content to anon, authenticated;
grant insert, update, delete on content.pages, content.news_posts, content.media_assets,
  content.homepage_slots, content.announcements to authenticated;
grant all on all tables in schema content to service_role;

grant execute on function content.search(text, integer) to anon, authenticated, service_role;
grant execute on function programmes.six_words_wall(integer) to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert or update or delete on content.pages
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on content.news_posts
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on content.homepage_slots
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on content.announcements
  for each row execute function private.log_activity();

-- Programmes: Side Quest episodes and reels, Six Words (Book of Members,
-- Typewriter Tour), rotas and shifts, and Side Quest removal requests.

create schema programmes;
grant usage on schema programmes to anon, authenticated, service_role;

create table programmes.episodes (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references core.programmes (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  season integer check (season > 0),
  number integer check (number > 0),
  segment text,
  title_en text not null,
  title_ar text not null,
  summary_en text,
  summary_ar text,
  -- Embedded through youtube-nocookie.com (privacy-enhanced mode).
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index episodes_programme_id_idx on programmes.episodes (programme_id, published_at desc);

create trigger set_updated_at before update on programmes.episodes
  for each row execute function private.set_updated_at();

create table programmes.reels (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references core.programmes (id) on delete cascade,
  episode_id uuid references programmes.episodes (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube_shorts')),
  url text not null check (url ~ '^https://(www\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/'),
  caption_en text,
  caption_ar text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index reels_programme_id_idx on programmes.reels (programme_id, published_at desc);
create index reels_episode_id_idx on programmes.reels (episode_id);

-- Six-word pieces typed on the Society Typewriter (Book of Members).
create table programmes.six_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  text text not null check (private.word_count(text) = 6 and char_length(text) <= 200),
  language text not null check (language in ('en', 'ar')),
  -- Show the author's name beside the piece on the public wall.
  show_name boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index six_words_status_idx on programmes.six_words (status, created_at desc);

create trigger set_updated_at before update on programmes.six_words
  for each row execute function private.set_updated_at();

-- An edit sends the piece back to moderation.
create function private.before_six_words_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.text is distinct from old.text or new.language is distinct from old.language then
    new.status := 'pending';
    new.moderated_by := null;
    new.moderated_at := null;
  end if;
  return new;
end;
$$;

create trigger before_six_words_update before update on programmes.six_words
  for each row execute function private.before_six_words_update();

create table programmes.rotas (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references core.programmes (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create index rotas_programme_id_idx on programmes.rotas (programme_id);

create table programmes.shifts (
  id uuid primary key default gen_random_uuid(),
  rota_id uuid not null references programmes.rotas (id) on delete cascade,
  event_id uuid references events.events (id) on delete set null,
  role_en text not null,
  role_ar text not null,
  location_en text,
  location_ar text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index shifts_rota_id_idx on programmes.shifts (rota_id, starts_at);
create index shifts_event_id_idx on programmes.shifts (event_id);

create table programmes.shift_signups (
  shift_id uuid not null references programmes.shifts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status text not null default 'signed_up'
    check (status in ('signed_up', 'confirmed', 'swap_requested', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shift_id, user_id)
);

create index shift_signups_user_id_idx on programmes.shift_signups (user_id);

create trigger set_updated_at before update on programmes.shift_signups
  for each row execute function private.set_updated_at();

-- Side Quest: a public form (through apps/api, rate-limited) opens a ticket;
-- programme leads and the Media Director are emailed and a 24-hour clock starts.
create table programmes.removal_requests (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references core.programmes (id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 1 and 200),
  requester_email text not null check (requester_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  content_url text check (char_length(content_url) <= 2048),
  details text not null check (char_length(details) between 1 and 4000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'removed', 'declined', 'closed')),
  action_taken text,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '24 hours',
  closed_at timestamptz,
  check (status in ('open', 'in_progress') or char_length(btrim(coalesce(action_taken, ''))) > 0)
);

create index removal_requests_open_idx on programmes.removal_requests (due_at)
  where status in ('open', 'in_progress');
create index removal_requests_programme_id_idx on programmes.removal_requests (programme_id);

create function private.after_removal_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue('programmes.removal_requested',
    jsonb_build_object('request_id', new.id, 'programme_id', new.programme_id));
  return new;
end;
$$;

create trigger after_removal_request after insert on programmes.removal_requests
  for each row execute function private.after_removal_request();

-- ── RPCs ────────────────────────────────────────────────────────────────────

create function programmes.sign_up_for_shift(shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s programmes.shifts;
  taken integer;
begin
  if not membership.is_member() then
    raise exception 'Only members can sign up for shifts' using errcode = '42501';
  end if;
  select * into s from programmes.shifts where id = sign_up_for_shift.shift_id for update;
  if not found then
    raise exception 'Shift not found' using errcode = 'P0002';
  end if;
  select count(*) into taken from programmes.shift_signups
  where shift_signups.shift_id = s.id and status <> 'cancelled';
  if taken >= s.capacity then
    raise exception 'This shift is full' using errcode = '23514';
  end if;

  insert into programmes.shift_signups (shift_id, user_id) values (s.id, auth.uid())
  on conflict (shift_id, user_id) do update set status = 'signed_up';
end;
$$;

create function programmes.moderate_six_words(entry_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not access.has_permission_anywhere('programmes.manage') then
    raise exception 'programmes.manage is required' using errcode = '42501';
  end if;
  update programmes.six_words
  set status = case when approve then 'approved' else 'rejected' end,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = entry_id;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table programmes.episodes enable row level security;
alter table programmes.reels enable row level security;
alter table programmes.six_words enable row level security;
alter table programmes.rotas enable row level security;
alter table programmes.shifts enable row level security;
alter table programmes.shift_signups enable row level security;
alter table programmes.removal_requests enable row level security;

create policy "Anyone reads published episodes"
  on programmes.episodes for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy "Programme managers manage episodes"
  on programmes.episodes for all to authenticated
  using ((select access.has_permission('programmes.manage', 'programme', programme_id)))
  with check ((select access.has_permission('programmes.manage', 'programme', programme_id)));

create policy "Anyone reads published reels"
  on programmes.reels for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy "Programme managers manage reels"
  on programmes.reels for all to authenticated
  using ((select access.has_permission('programmes.manage', 'programme', programme_id)))
  with check ((select access.has_permission('programmes.manage', 'programme', programme_id)));

create policy "Anyone reads approved six words"
  on programmes.six_words for select to anon, authenticated
  using (status = 'approved');
create policy "Members read their own six words"
  on programmes.six_words for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Moderators read every entry"
  on programmes.six_words for select to authenticated
  using ((select access.has_permission_anywhere('programmes.manage')));
create policy "Members write their own six words"
  on programmes.six_words for insert to authenticated
  with check (user_id = (select auth.uid()) and (select membership.is_member()));
create policy "Members edit their own six words"
  on programmes.six_words for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Members delete their own six words"
  on programmes.six_words for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Members read rotas"
  on programmes.rotas for select to authenticated
  using ((select membership.is_member()));
create policy "Programme managers manage rotas"
  on programmes.rotas for all to authenticated
  using ((select access.has_permission('programmes.manage', 'programme', programme_id)))
  with check ((select access.has_permission('programmes.manage', 'programme', programme_id)));

create policy "Members read shifts"
  on programmes.shifts for select to authenticated
  using ((select membership.is_member()));
create policy "Programme managers manage shifts"
  on programmes.shifts for all to authenticated
  using (exists (
    select 1 from programmes.rotas r where r.id = rota_id
      and (select access.has_permission('programmes.manage', 'programme', r.programme_id))
  ))
  with check (exists (
    select 1 from programmes.rotas r where r.id = rota_id
      and (select access.has_permission('programmes.manage', 'programme', r.programme_id))
  ));

create policy "Members read their own sign-ups"
  on programmes.shift_signups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Programme managers read sign-ups"
  on programmes.shift_signups for select to authenticated
  using (exists (
    select 1 from programmes.shifts s join programmes.rotas r on r.id = s.rota_id
    where s.id = shift_id
      and (select access.has_permission('programmes.manage', 'programme', r.programme_id))
  ));
create policy "Members confirm, swap or cancel their own shifts"
  on programmes.shift_signups for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('confirmed', 'swap_requested', 'cancelled'));
create policy "Programme managers update sign-ups"
  on programmes.shift_signups for update to authenticated
  using (exists (
    select 1 from programmes.shifts s join programmes.rotas r on r.id = s.rota_id
    where s.id = shift_id
      and (select access.has_permission('programmes.manage', 'programme', r.programme_id))
  ))
  with check (true);

create policy "Programme managers read removal requests"
  on programmes.removal_requests for select to authenticated
  using (
    (select access.has_permission('programmes.manage'))
    or (programme_id is not null
      and (select access.has_permission('programmes.manage', 'programme', programme_id)))
  );
create policy "Programme managers resolve removal requests"
  on programmes.removal_requests for update to authenticated
  using (
    (select access.has_permission('programmes.manage'))
    or (programme_id is not null
      and (select access.has_permission('programmes.manage', 'programme', programme_id)))
  )
  with check (
    (select access.has_permission('programmes.manage'))
    or (programme_id is not null
      and (select access.has_permission('programmes.manage', 'programme', programme_id)))
  );
-- No insert policy: the public form posts to apps/api, which rate-limits it.

revoke all on all tables in schema programmes from anon, authenticated;
revoke all on all functions in schema programmes from public, anon, authenticated;

grant select on programmes.episodes, programmes.reels, programmes.six_words to anon, authenticated;
grant select on programmes.rotas, programmes.shifts, programmes.shift_signups,
  programmes.removal_requests to authenticated;
grant insert, update, delete on programmes.episodes, programmes.reels,
  programmes.rotas, programmes.shifts to authenticated;
grant insert (text, language, show_name) on programmes.six_words to authenticated;
grant update (text, language, show_name) on programmes.six_words to authenticated;
grant delete on programmes.six_words to authenticated;
grant update (status) on programmes.shift_signups to authenticated;
grant update (status, action_taken, handled_by, closed_at) on programmes.removal_requests to authenticated;
grant all on all tables in schema programmes to service_role;

grant execute on function
  programmes.sign_up_for_shift(uuid),
  programmes.moderate_six_words(uuid, boolean)
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert or update or delete on programmes.episodes
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on programmes.reels
  for each row execute function private.log_activity();
create trigger log_activity after update on programmes.removal_requests
  for each row execute function private.log_activity();
create trigger log_activity after update of status on programmes.six_words
  for each row execute function private.log_activity();

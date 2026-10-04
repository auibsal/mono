-- Waraq: issues, pieces and contributors (published side) and the blind
-- submission pipeline (calls, submissions, blind entries, reader
-- assignments, rubric scores, decisions, agreements, status history).
--
-- Blind review
-- • journal.submissions holds the author. Only the author and holders of
--   `journal.identity.view` for the issue (the Submissions Manager) can read it.
-- • Readers and editors work from journal.blind_entries, keyed by a random
--   blind id, which carries no author data. The link between a blind entry
--   and its submission is journal.blind_keys, readable only by identity holders.
-- • journal.entry_author() reveals the author to the review team only after
--   a decision is recorded.

create schema journal;
grant usage on schema journal to anon, authenticated, service_role;

create type journal.category as enum (
  'poetry',
  'fiction',
  'creative_nonfiction',
  'short_drama',
  'art_photography',
  'translation',
  'six_words'
);

create type journal.submission_status as enum (
  'received',
  'intake_check',
  'in_review',
  'third_read',
  'selection',
  'accepted',
  'declined',
  'withdrawn'
);

create type journal.language as enum ('en', 'ar', 'bilingual');

-- ── Published side ──────────────────────────────────────────────────────────

create table journal.issues (
  id uuid primary key default gen_random_uuid(),
  volume integer not null check (volume > 0),
  number integer not null check (number > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_ar text not null,
  theme_en text,
  theme_ar text,
  editors_note_en text,
  editors_note_ar text,
  cover_path text,
  pdf_path text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volume, number),
  check (status <> 'scheduled' or publish_at is not null)
);

create trigger set_updated_at before update on journal.issues
  for each row execute function private.set_updated_at();

create table journal.contributors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  user_id uuid references auth.users (id) on delete set null,
  name_en text not null,
  name_ar text,
  bio_en text,
  bio_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contributors_user_id_idx on journal.contributors (user_id);

create trigger set_updated_at before update on journal.contributors
  for each row execute function private.set_updated_at();

create table journal.pieces (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references journal.issues (id) on delete set null,
  contributor_id uuid not null references journal.contributors (id),
  submission_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category journal.category not null,
  language journal.language not null,
  title_en text,
  title_ar text,
  -- Translation credit, e.g. "Translated from the Arabic by …".
  credit_en text,
  credit_ar text,
  image_path text,
  members_only boolean not null default false,
  sort integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title_en is not null or title_ar is not null),
  check (status <> 'scheduled' or publish_at is not null)
);

create index pieces_issue_id_idx on journal.pieces (issue_id, sort);
create index pieces_contributor_id_idx on journal.pieces (contributor_id);
create index pieces_published_idx on journal.pieces (status, published_at desc);

create trigger set_updated_at before update on journal.pieces
  for each row execute function private.set_updated_at();

-- The text of a piece, apart from its metadata, so members-only pieces can
-- be listed publicly (with a sign-in prompt) without exposing their text.
-- HTML is sanitised by the editor on save and again on render.
create table journal.piece_bodies (
  piece_id uuid primary key references journal.pieces (id) on delete cascade,
  body_en text,
  body_ar text,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on journal.piece_bodies
  for each row execute function private.set_updated_at();

-- ── Calls ───────────────────────────────────────────────────────────────────

create table journal.calls (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references journal.issues (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  theme_en text,
  theme_ar text,
  eligibility_en text,
  eligibility_ar text,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  max_per_person integer not null default 2 check (max_per_person between 1 and 10),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create index calls_issue_id_idx on journal.calls (issue_id);
create index calls_window_idx on journal.calls (opens_at, closes_at);

create trigger set_updated_at before update on journal.calls
  for each row execute function private.set_updated_at();

-- ── Submissions (identified) ────────────────────────────────────────────────

create table journal.submissions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references journal.calls (id),
  author_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  category journal.category not null,
  language journal.language not null,
  title text not null check (char_length(title) between 1 and 300),
  -- Rich text from the editor (sanitised), or empty when a file is uploaded.
  body_html text check (char_length(body_html) <= 200000),
  -- Translation needs the source text and a note on the rights to translate it.
  source_text text check (char_length(source_text) <= 200000),
  source_author text,
  rights_note text check (char_length(rights_note) <= 2000),
  cover_note text check (char_length(cover_note) <= 2000),
  -- Reconfirmed per submission (Human Authorship pledge).
  human_authorship_confirmed boolean not null check (human_authorship_confirmed),
  status journal.submission_status not null default 'received',
  intake_returned_at timestamptz,
  intake_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    category <> 'translation'
    or (
      char_length(btrim(coalesce(source_text, ''))) > 0
      and char_length(btrim(coalesce(rights_note, ''))) > 0
    )
  )
);

create index submissions_call_id_idx on journal.submissions (call_id, status);
create index submissions_author_id_idx on journal.submissions (author_id, created_at);

create trigger set_updated_at before update on journal.submissions
  for each row execute function private.set_updated_at();

alter table journal.pieces
  add constraint pieces_submission_id_fkey
  foreign key (submission_id) references journal.submissions (id) on delete set null;
create index pieces_submission_id_idx on journal.pieces (submission_id);

create table journal.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references journal.submissions (id) on delete cascade,
  kind text not null check (kind in ('manuscript', 'image', 'source')),
  -- Random object name in the private `submissions` bucket:
  -- <submission id>/<random>.<ext>
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  )),
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  -- Metadata-stripped copy for readers, made by apps/api:
  -- blind/<blind entry id>/<random>.<ext>
  blind_path text unique,
  created_at timestamptz not null default now(),
  check (storage_path like submission_id::text || '/%')
);

create index submission_files_submission_id_idx on journal.submission_files (submission_id);

-- ── Blind side ──────────────────────────────────────────────────────────────

create table journal.blind_entries (
  id uuid primary key default gen_random_uuid(),
  blind_id text not null unique check (blind_id ~ '^W-[0-9A-HJ-NP-Z]{6}$'),
  call_id uuid not null references journal.calls (id),
  issue_id uuid not null references journal.issues (id),
  category journal.category not null,
  language journal.language not null,
  title text not null,
  body_html text,
  source_text text,
  status journal.submission_status not null default 'in_review',
  editor_notes text,
  -- Advisory Board sees flagged pieces only.
  flagged boolean not null default false,
  flag_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blind_entries_issue_id_status_idx on journal.blind_entries (issue_id, status);
create index blind_entries_call_id_idx on journal.blind_entries (call_id);

create trigger set_updated_at before update on journal.blind_entries
  for each row execute function private.set_updated_at();

-- The key: which submission each blind id stands for.
create table journal.blind_keys (
  blind_entry_id uuid primary key references journal.blind_entries (id) on delete cascade,
  submission_id uuid not null unique references journal.submissions (id) on delete cascade
);

create table journal.assignments (
  id uuid primary key default gen_random_uuid(),
  blind_entry_id uuid not null references journal.blind_entries (id) on delete cascade,
  reader_id uuid not null references auth.users (id) on delete cascade,
  -- 1 and 2 are the two blind reads; 3 is the third read.
  read_number integer not null check (read_number between 1 and 3),
  assigned_by uuid references auth.users (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  unique (blind_entry_id, reader_id),
  unique (blind_entry_id, read_number)
);

create index assignments_reader_id_idx on journal.assignments (reader_id);

-- Rubric v2: four criteria scored 1–5, weighted to a total out of 100
-- (Craft 30, Voice 25, Depth 25, Archive Factor 20).
create table journal.scores (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references journal.assignments (id) on delete cascade,
  craft smallint not null check (craft between 1 and 5),
  voice smallint not null check (voice between 1 and 5),
  depth smallint not null check (depth between 1 and 5),
  archive_factor smallint not null check (archive_factor between 1 and 5),
  total smallint generated always as (
    craft * 6 + voice * 5 + depth * 5 + archive_factor * 4
  ) stored,
  comment text check (char_length(comment) <= 4000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on journal.scores
  for each row execute function private.set_updated_at();

create table journal.decisions (
  id uuid primary key default gen_random_uuid(),
  blind_entry_id uuid not null unique references journal.blind_entries (id) on delete cascade,
  decision text not null check (decision in ('accept', 'accept_with_edits', 'decline')),
  notes text,
  decided_by uuid references auth.users (id) on delete set null default auth.uid(),
  decided_at timestamptz not null default now()
);

create table journal.agreements (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references journal.submissions (id) on delete cascade,
  version text not null,
  signer_name text not null check (char_length(signer_name) between 2 and 200),
  signed_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  signed_at timestamptz not null default now()
);

create table journal.status_history (
  id bigint generated always as identity primary key,
  submission_id uuid not null references journal.submissions (id) on delete cascade,
  from_status journal.submission_status,
  to_status journal.submission_status not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index status_history_submission_id_idx on journal.status_history (submission_id, changed_at);

-- ── Helpers ─────────────────────────────────────────────────────────────────

create function private.call_issue(call_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select issue_id from journal.calls where id = call_id;
$$;

create function private.can_view_identity(issue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select access.has_permission('journal.identity.view', 'issue', issue_id);
$$;

-- Editors who see every blind entry and every score for an issue.
create function private.is_issue_editor(issue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select access.has_permission('journal.decide', 'issue', issue_id)
    or access.has_permission('journal.manage', 'issue', issue_id);
$$;

create function private.is_assigned_reader(blind_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from journal.assignments a
    where a.blind_entry_id = is_assigned_reader.blind_entry_id
      and a.reader_id = auth.uid()
  );
$$;

-- Random blind id such as W-7K3QXA (no I or O, to avoid misreading).
create function private.new_blind_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea;
  result text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    result := 'W-';
    for i in 0..5 loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 34) + 1, 1);
    end loop;
    exit when not exists (select 1 from journal.blind_entries where blind_id = result);
  end loop;
  return result;
end;
$$;

-- ── Submission rules (enforced in the database) ─────────────────────────────

create function private.before_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c journal.calls;
  existing integer;
  recent integer;
begin
  -- Serialise submissions per author so the counts below can't race.
  perform pg_advisory_xact_lock(hashtext('journal.submissions:' || new.author_id::text));

  select * into c from journal.calls where id = new.call_id;

  if not found or not c.is_published then
    raise exception 'Call not found' using errcode = 'P0002';
  end if;
  if now() < c.opens_at or now() > c.closes_at then
    raise exception 'This call is not open' using errcode = '22023';
  end if;

  select count(*) into existing from journal.submissions s
  where s.call_id = new.call_id and s.author_id = new.author_id and s.status <> 'withdrawn';
  if existing >= c.max_per_person then
    raise exception 'You can send at most % submissions to this call', c.max_per_person
      using errcode = '23514';
  end if;

  select count(*) into recent from journal.submissions s
  where s.author_id = new.author_id and s.created_at > now() - interval '1 hour';
  if recent >= 3 then
    raise exception 'Too many submissions in the last hour; try again later'
      using errcode = '54000';
  end if;

  new.status := 'received';
  return new;
end;
$$;

create trigger before_submission_insert before insert on journal.submissions
  for each row execute function private.before_submission_insert();

create function private.after_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into journal.status_history (submission_id, from_status, to_status, changed_by)
  values (new.id, null, 'received', new.author_id);
  perform private.enqueue('journal.submission_received',
    jsonb_build_object('submission_id', new.id, 'user_id', new.author_id));
  return new;
end;
$$;

create trigger after_submission_insert after insert on journal.submissions
  for each row execute function private.after_submission_insert();

-- ── Status transitions ──────────────────────────────────────────────────────

create function private.allowed_transition(
  from_status journal.submission_status,
  to_status journal.submission_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_status, to_status) in (
    ('received'::journal.submission_status, 'intake_check'::journal.submission_status),
    ('intake_check', 'in_review'),
    ('in_review', 'third_read'),
    ('in_review', 'selection'),
    ('third_read', 'selection'),
    ('selection', 'accepted'),
    ('selection', 'declined'),
    ('selection', 'in_review'),
    ('received', 'withdrawn'),
    ('intake_check', 'withdrawn'),
    ('in_review', 'withdrawn'),
    ('third_read', 'withdrawn'),
    ('selection', 'withdrawn')
  );
$$;

-- Moves a submission and records the move. Callers are trusted here; the
-- public RPCs below check who may make which move.
create function private.set_submission_status(
  submission_id uuid,
  to_status journal.submission_status,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status journal.submission_status;
begin
  select status into current_status from journal.submissions
  where id = set_submission_status.submission_id for update;

  if not private.allowed_transition(current_status, to_status) then
    raise exception 'A submission cannot move from % to %', current_status, to_status
      using errcode = '22023';
  end if;

  update journal.submissions set status = to_status where id = set_submission_status.submission_id;
  update journal.blind_entries b set status = to_status
  from journal.blind_keys k
  where k.blind_entry_id = b.id and k.submission_id = set_submission_status.submission_id;

  insert into journal.status_history (submission_id, from_status, to_status, note, changed_by)
  values (set_submission_status.submission_id, current_status, to_status, note, auth.uid());
end;
$$;

-- Creates the blind entry for a submission entering review (idempotent).
create function private.ensure_blind_entry(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s journal.submissions;
  entry_id uuid;
begin
  select b.blind_entry_id into entry_id from journal.blind_keys b
  where b.submission_id = ensure_blind_entry.submission_id;
  if found then
    return entry_id;
  end if;

  select * into s from journal.submissions where id = ensure_blind_entry.submission_id;

  insert into journal.blind_entries
    (blind_id, call_id, issue_id, category, language, title, body_html, source_text, status)
  values
    (private.new_blind_id(), s.call_id, private.call_issue(s.call_id), s.category,
     s.language, s.title, s.body_html, s.source_text, s.status)
  returning id into entry_id;

  insert into journal.blind_keys (blind_entry_id, submission_id) values (entry_id, s.id);
  return entry_id;
end;
$$;

-- The board's single move: drag-and-drop calls this with the card's id,
-- either a submission id (Submissions Manager) or a blind entry id (editors).
create function journal.transition_submission(
  id uuid,
  to_status journal.submission_status,
  note text default null
)
returns journal.submission_status
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s journal.submissions;
  issue uuid;
  is_identity boolean;
  is_editor boolean;
begin
  select sub.* into s from journal.submissions sub where sub.id = transition_submission.id;
  if not found then
    select sub.* into s from journal.submissions sub
    join journal.blind_keys k on k.submission_id = sub.id
    where k.blind_entry_id = transition_submission.id;
  end if;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  issue := private.call_issue(s.call_id);
  is_identity := private.can_view_identity(issue);
  is_editor := private.is_issue_editor(issue);

  if to_status = 'withdrawn' then
    if not (s.author_id = auth.uid() or is_identity) then
      raise exception 'Only the author or the Submissions Manager can withdraw'
        using errcode = '42501';
    end if;
  elsif to_status in ('accepted', 'declined') then
    raise exception 'Record a decision to accept or decline' using errcode = '22023';
  elsif s.status in ('received', 'intake_check') then
    -- Intake is a formatting gate run by the Submissions Manager.
    if not is_identity then
      raise exception 'journal.identity.view is required for intake' using errcode = '42501';
    end if;
  elsif not is_editor then
    raise exception 'journal.manage or journal.decide is required' using errcode = '42501';
  end if;

  if to_status = 'in_review' and s.status = 'intake_check' then
    perform private.ensure_blind_entry(s.id);
  end if;

  perform private.set_submission_status(s.id, to_status, note);

  if to_status = 'intake_check' then
    update journal.submissions set intake_returned_at = null, intake_note = null where id = s.id;
  end if;

  return to_status;
end;
$$;

-- Intake check: return for formatting fixes (not a score).
create function journal.return_for_formatting(submission_id uuid, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s journal.submissions;
begin
  select * into s from journal.submissions where id = return_for_formatting.submission_id;
  if not found or not private.can_view_identity(private.call_issue(s.call_id)) then
    raise exception 'journal.identity.view is required' using errcode = '42501';
  end if;
  if s.status not in ('received', 'intake_check') then
    raise exception 'Only submissions in intake can be returned' using errcode = '22023';
  end if;
  if s.status = 'received' then
    perform private.set_submission_status(s.id, 'intake_check', 'Returned for formatting');
  end if;

  update journal.submissions
  set intake_returned_at = now(), intake_note = note
  where id = s.id;

  perform private.enqueue('journal.returned_for_formatting',
    jsonb_build_object('submission_id', s.id, 'user_id', s.author_id, 'note', note));
end;
$$;

-- Assign a reader to a blind entry (Submissions Manager). A reader is
-- never assigned their own work.
create function journal.assign_reader(blind_entry_id uuid, reader_id uuid, read_number integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry journal.blind_entries;
  new_id uuid;
begin
  select * into entry from journal.blind_entries where id = assign_reader.blind_entry_id;
  if not found or not private.can_view_identity(entry.issue_id) then
    raise exception 'journal.identity.view is required' using errcode = '42501';
  end if;
  if exists (
    select 1 from journal.blind_keys k
    join journal.submissions s on s.id = k.submission_id
    where k.blind_entry_id = entry.id and s.author_id = reader_id
  ) then
    raise exception 'A reader cannot read their own submission' using errcode = '22023';
  end if;
  if reader_id = auth.uid() then
    raise exception 'The Submissions Manager holds the key and never scores'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    where a.user_id = reader_id
      and rp.permission = 'journal.review'
      and (a.scope_type = 'global' or (a.scope_type = 'issue' and a.scope_id = entry.issue_id))
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  ) then
    raise exception 'Readers need journal.review for this issue' using errcode = '22023';
  end if;

  insert into journal.assignments (blind_entry_id, reader_id, read_number)
  values (entry.id, reader_id, read_number)
  returning id into new_id;
  return new_id;
end;
$$;

-- After a score: if both blind reads are in and their totals differ by more
-- than 20, the entry goes to a third read.
create function private.after_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_id uuid;
  first_total integer;
  second_total integer;
  submission uuid;
  entry_status journal.submission_status;
begin
  select a.blind_entry_id into entry_id from journal.assignments a where a.id = new.assignment_id;

  select sc.total into first_total from journal.scores sc
  join journal.assignments a on a.id = sc.assignment_id
  where a.blind_entry_id = entry_id and a.read_number = 1;
  select sc.total into second_total from journal.scores sc
  join journal.assignments a on a.id = sc.assignment_id
  where a.blind_entry_id = entry_id and a.read_number = 2;

  select k.submission_id, b.status into submission, entry_status
  from journal.blind_keys k join journal.blind_entries b on b.id = k.blind_entry_id
  where k.blind_entry_id = entry_id;

  if first_total is not null and second_total is not null
     and abs(first_total - second_total) > 20
     and entry_status = 'in_review' then
    perform private.set_submission_status(
      submission, 'third_read',
      format('Reader totals %s and %s differ by more than 20', first_total, second_total)
    );
  end if;

  return new;
end;
$$;

create trigger after_score after insert or update on journal.scores
  for each row execute function private.after_score();

-- Readers may only score their own assignment, and only while the entry is
-- being read.
create function private.before_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_status journal.submission_status;
begin
  select b.status into entry_status from journal.assignments a
  join journal.blind_entries b on b.id = a.blind_entry_id
  where a.id = new.assignment_id;

  if entry_status not in ('in_review', 'third_read') then
    raise exception 'Scores are closed for this entry' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger before_score before insert or update on journal.scores
  for each row execute function private.before_score();

-- Record a decision (accept, accept with edits, decline).
create function journal.decide(blind_entry_id uuid, decision text, notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry journal.blind_entries;
  submission journal.submissions;
  new_id uuid;
begin
  select * into entry from journal.blind_entries where id = decide.blind_entry_id for update;
  if not found or not access.has_permission('journal.decide', 'issue', entry.issue_id) then
    raise exception 'journal.decide is required' using errcode = '42501';
  end if;
  if entry.status <> 'selection' then
    raise exception 'Only pieces in selection can be decided' using errcode = '22023';
  end if;

  insert into journal.decisions (blind_entry_id, decision, notes)
  values (entry.id, decide.decision, decide.notes)
  returning id into new_id;

  select s.* into submission from journal.submissions s
  join journal.blind_keys k on k.submission_id = s.id
  where k.blind_entry_id = entry.id;

  perform private.set_submission_status(
    submission.id,
    case when decide.decision = 'decline' then 'declined' else 'accepted' end::journal.submission_status,
    decide.notes
  );

  perform private.enqueue('journal.decision',
    jsonb_build_object(
      'submission_id', submission.id,
      'user_id', submission.author_id,
      'decision', decide.decision
    ));
  return new_id;
end;
$$;

-- The author of a blind entry, for the review team, once decided.
create function journal.entry_author(blind_entry_id uuid)
returns table (author_name_en text, author_name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name_en, p.full_name_ar
  from journal.blind_entries b
  join journal.decisions d on d.blind_entry_id = b.id
  join journal.blind_keys k on k.blind_entry_id = b.id
  join journal.submissions s on s.id = k.submission_id
  join core.profiles p on p.id = s.author_id
  where b.id = entry_author.blind_entry_id
    and (private.is_assigned_reader(b.id) or private.is_issue_editor(b.issue_id)
      or private.can_view_identity(b.issue_id));
$$;

-- Sign the publication agreement (author, once accepted).
create function journal.sign_agreement(submission_id uuid, signer_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s journal.submissions;
  new_id uuid;
  version text := coalesce(private.setting('journal.agreement.version') #>> '{}', '1');
begin
  select * into s from journal.submissions where id = sign_agreement.submission_id;
  if not found or s.author_id <> auth.uid() then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if s.status <> 'accepted' then
    raise exception 'Only accepted work has an agreement to sign' using errcode = '22023';
  end if;

  insert into journal.agreements (submission_id, version, signer_name)
  values (s.id, version, sign_agreement.signer_name)
  returning id into new_id;
  return new_id;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table journal.issues enable row level security;
alter table journal.contributors enable row level security;
alter table journal.pieces enable row level security;
alter table journal.piece_bodies enable row level security;
alter table journal.calls enable row level security;
alter table journal.submissions enable row level security;
alter table journal.submission_files enable row level security;
alter table journal.blind_entries enable row level security;
alter table journal.blind_keys enable row level security;
alter table journal.assignments enable row level security;
alter table journal.scores enable row level security;
alter table journal.decisions enable row level security;
alter table journal.agreements enable row level security;
alter table journal.status_history enable row level security;

-- Published: issues, contributors, pieces.
create policy "Anyone reads published issues"
  on journal.issues for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy "Journal publishers read and write issues"
  on journal.issues for all to authenticated
  using ((select access.has_permission('journal.publish', 'issue', id)))
  with check ((select access.has_permission('journal.publish', 'issue', id)));
create policy "Global journal publishers create issues"
  on journal.issues for insert to authenticated
  with check ((select access.has_permission('journal.publish')));

create policy "Anyone reads contributors with published work"
  on journal.contributors for select to anon, authenticated
  using (exists (
    select 1 from journal.pieces p
    where p.contributor_id = contributors.id
      and p.status = 'published' and p.published_at <= now()
  ));
create policy "Contributors read their own record"
  on journal.contributors for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Journal publishers manage contributors"
  on journal.contributors for all to authenticated
  using ((select access.has_permission_anywhere('journal.publish')))
  with check ((select access.has_permission_anywhere('journal.publish')));

create policy "Anyone reads published pieces"
  on journal.pieces for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy "Journal publishers manage pieces"
  on journal.pieces for all to authenticated
  using (
    (select access.has_permission('journal.publish'))
    or (issue_id is not null and (select access.has_permission('journal.publish', 'issue', issue_id)))
  )
  with check (
    (select access.has_permission('journal.publish'))
    or (issue_id is not null and (select access.has_permission('journal.publish', 'issue', issue_id)))
  );

create policy "Anyone reads the text of published public pieces"
  on journal.piece_bodies for select to anon, authenticated
  using (exists (
    select 1 from journal.pieces p
    where p.id = piece_id and p.status = 'published' and p.published_at <= now()
      and not p.members_only
  ));
create policy "Members read the text of published members-only pieces"
  on journal.piece_bodies for select to authenticated
  using ((select membership.is_member()) and exists (
    select 1 from journal.pieces p
    where p.id = piece_id and p.status = 'published' and p.published_at <= now()
  ));
create policy "Journal publishers manage piece text"
  on journal.piece_bodies for all to authenticated
  using (exists (
    select 1 from journal.pieces p
    where p.id = piece_id
      and ((select access.has_permission('journal.publish'))
        or (p.issue_id is not null and (select access.has_permission('journal.publish', 'issue', p.issue_id))))
  ))
  with check (exists (
    select 1 from journal.pieces p
    where p.id = piece_id
      and ((select access.has_permission('journal.publish'))
        or (p.issue_id is not null and (select access.has_permission('journal.publish', 'issue', p.issue_id))))
  ));

-- Calls.
create policy "Anyone reads published calls"
  on journal.calls for select to anon, authenticated
  using (is_published);
create policy "Journal managers manage calls"
  on journal.calls for all to authenticated
  using ((select access.has_permission('journal.manage', 'issue', issue_id)))
  with check ((select access.has_permission('journal.manage', 'issue', issue_id)));

-- Submissions: the author and the Submissions Manager only.
create policy "Authors read their own submissions"
  on journal.submissions for select to authenticated
  using (author_id = (select auth.uid()));
create policy "Submissions Managers read submissions for their issue"
  on journal.submissions for select to authenticated
  using ((select private.can_view_identity(private.call_issue(call_id))));
create policy "Members submit their own work with current pledges"
  on journal.submissions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select membership.is_member())
    and (select membership.has_current_pledges())
  );
create policy "Authors revise work returned for formatting"
  on journal.submissions for update to authenticated
  using (
    author_id = (select auth.uid())
    and (status = 'received' or (status = 'intake_check' and intake_returned_at is not null))
  )
  with check (author_id = (select auth.uid()));

create policy "Authors read their own files"
  on journal.submission_files for select to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id and s.author_id = (select auth.uid())
  ));
create policy "Submissions Managers read files"
  on journal.submission_files for select to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id
      and (select private.can_view_identity(private.call_issue(s.call_id)))
  ));
create policy "Authors attach files to work in intake"
  on journal.submission_files for insert to authenticated
  with check (exists (
    select 1 from journal.submissions s
    where s.id = submission_id and s.author_id = (select auth.uid())
      and (s.status = 'received' or (s.status = 'intake_check' and s.intake_returned_at is not null))
  ));
create policy "Authors remove files from work in intake"
  on journal.submission_files for delete to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id and s.author_id = (select auth.uid())
      and (s.status = 'received' or (s.status = 'intake_check' and s.intake_returned_at is not null))
  ));

-- Blind side.
create policy "Assigned readers read their blind entries"
  on journal.blind_entries for select to authenticated
  using ((select private.is_assigned_reader(id)));
create policy "Issue editors read blind entries"
  on journal.blind_entries for select to authenticated
  using ((select private.is_issue_editor(issue_id)) or (select private.can_view_identity(issue_id)));
create policy "Advisory Board reads flagged entries"
  on journal.blind_entries for select to authenticated
  using (flagged and (select access.has_permission('journal.advise', 'issue', issue_id)));
create policy "Issue editors annotate blind entries"
  on journal.blind_entries for update to authenticated
  using ((select private.is_issue_editor(issue_id)))
  with check ((select private.is_issue_editor(issue_id)));

create policy "Submissions Managers read the key"
  on journal.blind_keys for select to authenticated
  using (exists (
    select 1 from journal.blind_entries b
    where b.id = blind_entry_id and (select private.can_view_identity(b.issue_id))
  ));

create policy "Readers read their own assignments"
  on journal.assignments for select to authenticated
  using (reader_id = (select auth.uid()));
create policy "Issue editors and the Submissions Manager read assignments"
  on journal.assignments for select to authenticated
  using (exists (
    select 1 from journal.blind_entries b
    where b.id = blind_entry_id
      and ((select private.is_issue_editor(b.issue_id)) or (select private.can_view_identity(b.issue_id)))
  ));
create policy "Submissions Managers remove assignments"
  on journal.assignments for delete to authenticated
  using (exists (
    select 1 from journal.blind_entries b
    where b.id = blind_entry_id and (select private.can_view_identity(b.issue_id))
  ));

create policy "Readers read their own scores"
  on journal.scores for select to authenticated
  using (exists (
    select 1 from journal.assignments a
    where a.id = assignment_id and a.reader_id = (select auth.uid())
  ));
create policy "Issue editors read every score"
  on journal.scores for select to authenticated
  using (exists (
    select 1 from journal.assignments a
    join journal.blind_entries b on b.id = a.blind_entry_id
    where a.id = assignment_id and (select private.is_issue_editor(b.issue_id))
  ));
create policy "Readers score their own assignments"
  on journal.scores for insert to authenticated
  with check (exists (
    select 1 from journal.assignments a
    where a.id = assignment_id and a.reader_id = (select auth.uid())
  ));
create policy "Readers revise their own scores"
  on journal.scores for update to authenticated
  using (exists (
    select 1 from journal.assignments a
    where a.id = assignment_id and a.reader_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from journal.assignments a
    where a.id = assignment_id and a.reader_id = (select auth.uid())
  ));

create policy "The review team reads decisions"
  on journal.decisions for select to authenticated
  using (exists (
    select 1 from journal.blind_entries b
    where b.id = blind_entry_id
      and ((select private.is_issue_editor(b.issue_id))
        or (select private.can_view_identity(b.issue_id))
        or (select private.is_assigned_reader(b.id)))
  ));

create policy "Authors read their own agreements"
  on journal.agreements for select to authenticated
  using (signed_by = (select auth.uid()));
create policy "Submissions Managers read agreements"
  on journal.agreements for select to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id
      and (select private.can_view_identity(private.call_issue(s.call_id)))
  ));

create policy "Authors read their own status history"
  on journal.status_history for select to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id and s.author_id = (select auth.uid())
  ));
create policy "Submissions Managers read status history"
  on journal.status_history for select to authenticated
  using (exists (
    select 1 from journal.submissions s
    where s.id = submission_id
      and (select private.can_view_identity(private.call_issue(s.call_id)))
  ));

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on all tables in schema journal from anon, authenticated;
revoke all on all functions in schema journal from public, anon, authenticated;

grant select on journal.issues, journal.contributors, journal.pieces,
  journal.piece_bodies, journal.calls to anon, authenticated;
grant select on journal.submissions, journal.submission_files, journal.blind_entries,
  journal.blind_keys, journal.assignments, journal.scores, journal.decisions,
  journal.agreements, journal.status_history to authenticated;

grant insert, update, delete on journal.issues, journal.contributors,
  journal.pieces, journal.piece_bodies, journal.calls to authenticated;
grant insert (call_id, category, language, title, body_html, source_text,
  source_author, rights_note, cover_note, human_authorship_confirmed)
  on journal.submissions to authenticated;
grant update (title, body_html, source_text, source_author, rights_note, cover_note)
  on journal.submissions to authenticated;
grant insert (submission_id, kind, storage_path, mime_type, size_bytes)
  on journal.submission_files to authenticated;
grant delete on journal.submission_files to authenticated;
grant update (editor_notes, flagged, flag_note) on journal.blind_entries to authenticated;
grant delete on journal.assignments to authenticated;
grant insert (assignment_id, craft, voice, depth, archive_factor, comment)
  on journal.scores to authenticated;
grant update (craft, voice, depth, archive_factor, comment) on journal.scores to authenticated;

grant all on all tables in schema journal to service_role;
grant usage, select on all sequences in schema journal to service_role;

grant execute on function
  journal.transition_submission(uuid, journal.submission_status, text),
  journal.return_for_formatting(uuid, text),
  journal.assign_reader(uuid, uuid, integer),
  journal.decide(uuid, text, text),
  journal.entry_author(uuid),
  journal.sign_agreement(uuid, text)
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert or update or delete on journal.issues
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on journal.pieces
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on journal.decisions
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on journal.agreements
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on journal.calls
  for each row execute function private.log_activity();

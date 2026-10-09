-- Forms (Templates & Forms, SAL-OPS-02). The forms not already built into
-- their own modules are filled in the Nexus: role applications (F-03),
-- interview score sheets (F-04), onboarding and offboarding checklists
-- (F-06, F-27), General Assembly motions (F-09), program pitches (F-10),
-- event plans and risk checks (F-11), expense claims (F-13), cash counts
-- (F-14), media releases (F-17), incident reports (F-19), concerns and
-- complaints (F-20), handover dossiers (F-24), semester reports (F-25 A)
-- and program charters (F-29).
--
-- One registry, `governance.form_types`, says for each form who may fill
-- it in, which permission handles it, whether it may be anonymous and
-- whether it stays open for updates (checklists, dossiers). The fields
-- themselves are defined in @repo/sal-data/forms. Submissions are written
-- only through the RPCs below.
--
-- Restricted forms:
--   * Incident reports (F-19) are handled only by those who manage events
--     Society-wide, never by a program-scoped lead.
--   * Concerns and complaints (F-20) go to the President, the Vice
--     President and the Faculty Advisor; one about the Vice President never
--     reaches the Vice President, and one about the President never reaches
--     the President (Templates & Forms F-20). They may be anonymous: then no
--     account is stored with them at all.

-- ── Permissions ────────────────────────────────────────────────────────────

insert into access.permissions (key, description) values
  ('concerns.handle', 'Receive and answer concerns and complaints (Form F-20)'),
  ('concerns.about_vp', 'Receive concerns about the Vice President'),
  ('concerns.about_president', 'Receive concerns about the President');

insert into access.role_permissions (role, permission) values
  ('president', 'concerns.handle'),
  ('president', 'concerns.about_vp'),
  ('vice_president', 'concerns.handle'),
  ('vice_president', 'concerns.about_president'),
  ('faculty_advisor', 'concerns.handle'),
  ('faculty_advisor', 'concerns.about_vp'),
  ('faculty_advisor', 'concerns.about_president');

-- ── Registry ───────────────────────────────────────────────────────────────

create table governance.form_types (
  key text primary key check (key ~ '^f[0-9]{2}[a-z]?$'),
  -- Form number as printed (F-03, F-25 A).
  code text not null unique,
  -- Who may fill it in: anyone signed in, verified members, anyone holding
  -- a role, or only its handlers.
  submit_rule text not null check (submit_rule in ('anyone', 'member', 'role_holder', 'handler')),
  -- The permission (held Society-wide) that receives and handles it.
  handle_permission text not null references access.permissions (key),
  anonymous_ok boolean not null default false,
  -- Stays open for updates by its handlers and its subject until closed.
  ongoing boolean not null default false,
  -- The person a form is about (onboarding, offboarding, the incoming
  -- holder of a handover dossier) may read it.
  subject_reads boolean not null default false,
  -- Days to acknowledge and to answer, where the form sets them.
  acknowledge_days integer check (acknowledge_days > 0),
  answer_days integer check (answer_days > 0),
  sort integer not null default 0
);

comment on table governance.form_types is
  'Forms in the Nexus (Templates & Forms): who fills each in and who handles it. Fields live in @repo/sal-data/forms.';

insert into governance.form_types
  (key, code, submit_rule, handle_permission, anonymous_ok, ongoing, subject_reads, acknowledge_days, answer_days, sort) values
  ('f03', 'F-03', 'anyone', 'members.manage', false, false, false, null, null, 10),
  ('f04', 'F-04', 'handler', 'members.manage', false, false, false, null, null, 20),
  ('f06', 'F-06', 'handler', 'members.manage', false, true, true, null, null, 30),
  ('f09', 'F-09', 'member', 'governance.manage', false, false, false, null, null, 40),
  ('f10', 'F-10', 'member', 'programmes.manage', false, false, false, null, null, 50),
  ('f11', 'F-11', 'role_holder', 'events.manage', false, false, false, null, null, 60),
  ('f13', 'F-13', 'role_holder', 'spending.countersign', false, false, false, null, 14, 70),
  ('f14', 'F-14', 'role_holder', 'spending.countersign', false, false, false, null, null, 80),
  ('f17', 'F-17', 'anyone', 'content.manage', false, false, false, null, null, 90),
  ('f19', 'F-19', 'anyone', 'events.manage', false, false, false, 1, null, 100),
  ('f20', 'F-20', 'anyone', 'concerns.handle', true, false, false, 3, 14, 110),
  ('f24', 'F-24', 'role_holder', 'governance.manage', false, true, true, null, null, 120),
  ('f25a', 'F-25 A', 'handler', 'governance.manage', false, true, false, null, null, 130),
  ('f27', 'F-27', 'handler', 'governance.manage', false, true, true, null, null, 140),
  ('f29', 'F-29', 'role_holder', 'programmes.manage', false, true, false, null, null, 150);

alter table governance.form_types enable row level security;

create policy "Signed-in people read the forms registry"
  on governance.form_types for select to authenticated
  using (true);

create policy "Third-party apps reach only their areas"
  on governance.form_types as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select on governance.form_types to authenticated;
grant all on governance.form_types to service_role;

-- ── Submissions ────────────────────────────────────────────────────────────

create table governance.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_key text not null references governance.form_types (key),
  -- Null only for an anonymous concern (F-20): no account is kept.
  submitted_by uuid references auth.users (id) on delete set null,
  -- The person the form is about (F-06, F-24 incoming holder, F-27).
  subject_user_id uuid references auth.users (id) on delete set null,
  -- F-20: who must not receive it ('vice_president', 'president').
  routing text not null default 'none' check (routing in ('none', 'vice_president', 'president')),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 60000),
  -- "Office use" boxes, kept by the handlers.
  office jsonb not null default '{}' check (jsonb_typeof(office) = 'object' and octet_length(office::text) <= 10000),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'acknowledged', 'in_progress', 'closed')),
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  closed_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or submitted_at is not null),
  check (status <> 'draft' or submitted_by is not null)
);

comment on table governance.form_submissions is
  'Forms filled in the Nexus (Templates & Forms). Written only through governance.save_form and governance.handle_form.';

create index form_submissions_form_key_idx on governance.form_submissions (form_key, status, submitted_at desc);
create index form_submissions_submitted_by_idx on governance.form_submissions (submitted_by);
create index form_submissions_subject_user_id_idx on governance.form_submissions (subject_user_id);
create index form_submissions_handled_by_idx on governance.form_submissions (handled_by);

create trigger set_updated_at before update on governance.form_submissions
  for each row execute function private.set_updated_at();

-- Who handles a submission: its form's permission, held Society-wide, and
-- for concerns the routing permission when it is about an officer.
create function private.may_handle_form(form_key text, routing text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from governance.form_types t
    where t.key = may_handle_form.form_key
      and access.has_permission(t.handle_permission)
  )
  and (may_handle_form.routing <> 'vice_president' or access.has_permission('concerns.about_vp'))
  and (may_handle_form.routing <> 'president' or access.has_permission('concerns.about_president'));
$$;

revoke all on function private.may_handle_form(text, text) from public, anon;
grant execute on function private.may_handle_form(text, text) to authenticated;

create function private.may_submit_form(form_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from governance.form_types t
    where t.key = may_submit_form.form_key
      and case t.submit_rule
        when 'anyone' then auth.uid() is not null
        when 'member' then membership.is_member()
        when 'role_holder' then exists (
          select 1 from access.role_assignments a
          where a.user_id = auth.uid() and a.starts_at <= now()
            and (a.ends_at is null or a.ends_at > now())
        )
        when 'handler' then access.has_permission(t.handle_permission)
        else false
      end
  );
$$;

revoke all on function private.may_submit_form(text) from public, anon;
grant execute on function private.may_submit_form(text) to authenticated;

-- Saves a draft or submits a form. With `submission_id`, updates the
-- caller's own draft, or an open checklist or dossier the caller handles
-- or is the subject of. An anonymous form (F-20 only) is submitted at once
-- and keeps no account.
create function governance.save_form(
  form_key text,
  data jsonb,
  submission_id uuid default null,
  submit boolean default true,
  anonymous boolean default false,
  subject_id uuid default null,
  routing text default 'none'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t governance.form_types;
  s governance.form_submissions;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  select * into t from governance.form_types where key = save_form.form_key;
  if not found then
    raise exception 'unknown_form' using errcode = 'P0002';
  end if;
  if data is null or jsonb_typeof(data) <> 'object' then
    raise exception 'invalid_data' using errcode = '22023';
  end if;
  if coalesce(routing, 'none') <> 'none' and t.key <> 'f20' then
    raise exception 'routing_only_for_concerns' using errcode = '22023';
  end if;

  if submission_id is null then
    if not private.may_submit_form(t.key) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if anonymous and not t.anonymous_ok then
      raise exception 'anonymous_not_allowed' using errcode = '22023';
    end if;
    if subject_id is not null and not t.subject_reads then
      raise exception 'no_subject_for_this_form' using errcode = '22023';
    end if;
    insert into governance.form_submissions (
      form_key, submitted_by, subject_user_id, routing, data, status, submitted_at
    ) values (
      t.key,
      case when anonymous then null else auth.uid() end,
      subject_id,
      coalesce(routing, 'none'),
      data,
      case when submit or anonymous then 'submitted' else 'draft' end,
      case when submit or anonymous then now() end
    )
    returning id into new_id;
    return new_id;
  end if;

  select * into s from governance.form_submissions
  where id = submission_id and form_submissions.form_key = t.key
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if s.status = 'draft' and s.submitted_by = auth.uid() then
    update governance.form_submissions set
      data = save_form.data,
      subject_user_id = coalesce(subject_id, s.subject_user_id),
      routing = coalesce(save_form.routing, 'none'),
      status = case when submit then 'submitted' else 'draft' end,
      submitted_at = case when submit then now() end
    where id = s.id;
  elsif t.ongoing and s.status <> 'closed' and s.status <> 'draft'
    and (private.may_handle_form(s.form_key, s.routing) or s.subject_user_id = auth.uid()
      or s.submitted_by = auth.uid()) then
    update governance.form_submissions set data = save_form.data where id = s.id;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return s.id;
end;
$$;

-- Handlers acknowledge, take up and close submissions, and keep the
-- "office use" boxes.
create function governance.handle_form(submission_id uuid, status text, office jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s governance.form_submissions;
begin
  select * into s from governance.form_submissions where id = submission_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.may_handle_form(s.form_key, s.routing) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if s.status = 'draft' then
    raise exception 'not_submitted' using errcode = '22023';
  end if;
  if handle_form.status not in ('acknowledged', 'in_progress', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if s.status = 'closed' and handle_form.status <> 'closed' and s.form_key not in (
    select key from governance.form_types where ongoing
  ) then
    raise exception 'already_closed' using errcode = '22023';
  end if;
  if office is not null and jsonb_typeof(office) <> 'object' then
    raise exception 'invalid_office' using errcode = '22023';
  end if;
  update governance.form_submissions set
    status = handle_form.status,
    acknowledged_at = coalesce(s.acknowledged_at, now()),
    closed_at = case when handle_form.status = 'closed' then now() end,
    handled_by = auth.uid(),
    office = s.office || coalesce(handle_form.office, '{}'::jsonb)
  where id = s.id;
end;
$$;

-- A submitter withdraws their own draft.
create function governance.discard_form_draft(submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from governance.form_submissions
  where id = submission_id and submitted_by = auth.uid() and status = 'draft';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- What each handler has waiting, for the admin queue.
create function governance.form_queue()
returns table (form_key text, waiting bigint, overdue bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.form_key,
    count(*) filter (where s.status in ('submitted', 'acknowledged', 'in_progress')),
    count(*) filter (where
      (s.status = 'submitted' and t.acknowledge_days is not null
        and s.submitted_at < now() - make_interval(days => t.acknowledge_days))
      or (s.status in ('submitted', 'acknowledged', 'in_progress') and t.answer_days is not null
        and s.submitted_at < now() - make_interval(days => t.answer_days)))
  from governance.form_submissions s
  join governance.form_types t on t.key = s.form_key
  where s.status <> 'draft' and private.may_handle_form(s.form_key, s.routing)
  group by s.form_key;
$$;

revoke all on function
  governance.save_form(text, jsonb, uuid, boolean, boolean, uuid, text),
  governance.handle_form(uuid, text, jsonb),
  governance.discard_form_draft(uuid),
  governance.form_queue()
  from public, anon;
grant execute on function
  governance.save_form(text, jsonb, uuid, boolean, boolean, uuid, text),
  governance.handle_form(uuid, text, jsonb),
  governance.discard_form_draft(uuid),
  governance.form_queue()
  to authenticated;

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table governance.form_submissions enable row level security;

-- Reads only; every write goes through the RPCs above.
create policy "Submitters, handlers and subjects read submissions"
  on governance.form_submissions for select to authenticated
  using (
    submitted_by = (select auth.uid())
    or (status <> 'draft' and (select private.may_handle_form(form_key, routing)))
    or (status <> 'draft' and subject_user_id = (select auth.uid()) and exists (
      select 1 from governance.form_types t where t.key = form_key and t.subject_reads
    ))
  );

create policy "Third-party apps reach only their areas"
  on governance.form_submissions as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select on governance.form_submissions to authenticated;
grant all on governance.form_submissions to service_role;

-- No activity-log trigger: the log records who acted, which would undo an
-- anonymous concern, and it would copy incident and complaint text to
-- everyone who reads the log.

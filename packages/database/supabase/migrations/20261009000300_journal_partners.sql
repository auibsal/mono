-- The Journal's partner pathway. A call may name partners whose verified
-- members may submit too: only while that partner's signed memorandum
-- grants `journal_submissions` (20261009000100), and with the same pledges,
-- limits and blind review as members. Policy Manual P8.3 ("reading a
-- partner's submission") is enforced: a reader who has declared a conflict
-- with the partner a submission came through is not assigned to it. A
-- partner's editor can be given the Guest Editor role for one issue, only
-- if their partner's memorandum grants `guest_editing`.

-- ── Calls open to partners ─────────────────────────────────────────────────

create table journal.call_partners (
  call_id uuid not null references journal.calls (id) on delete cascade,
  partner_id uuid not null references governance.partners (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (call_id, partner_id)
);

comment on table journal.call_partners is
  'Partners whose verified members may answer a call (needs a memorandum granting journal_submissions).';

create index call_partners_partner_id_idx on journal.call_partners (partner_id);
create index call_partners_added_by_idx on journal.call_partners (added_by);

alter table journal.call_partners enable row level security;

create policy "Journal managers choose a call's partners"
  on journal.call_partners for all to authenticated
  using (exists (
    select 1 from journal.calls c
    where c.id = call_id and (select access.has_permission('journal.manage', 'issue', c.issue_id))
  ))
  with check (exists (
    select 1 from journal.calls c
    where c.id = call_id and (select access.has_permission('journal.manage', 'issue', c.issue_id))
  ));

create policy "Third-party apps reach only their areas"
  on journal.call_partners as restrictive for all to authenticated
  using ((select private.client_allows('journal')))
  with check ((select private.client_allows('journal')));

grant select, insert, delete on journal.call_partners to authenticated;
grant all on journal.call_partners to service_role;

-- A call may only be opened to a partner whose memorandum grants Journal
-- submissions today.
create function private.guard_call_partner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ('journal_submissions' = any (private.partner_grants(new.partner_id))) then
    raise exception 'partner_not_granted' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_call_partner before insert on journal.call_partners
  for each row execute function private.guard_call_partner();

-- True when the caller may submit to the call through the partner.
create function private.can_submit_through(partner uuid, call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from journal.call_partners cp
    where cp.call_id = call and cp.partner_id = partner
  ) and private.is_affiliated(auth.uid(), partner, 'journal_submissions');
$$;

revoke all on function private.can_submit_through(uuid, uuid) from public, anon;
grant execute on function private.can_submit_through(uuid, uuid) to authenticated;

-- The partners named on a published call, for its public page: listed
-- partners only (unlisted ones stay unnamed).
create function journal.call_partner_names(call_id uuid)
returns table (name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name_en, p.name_ar
  from journal.call_partners cp
  join journal.calls c on c.id = cp.call_id
  join governance.partners p on p.id = cp.partner_id
  where cp.call_id = call_partner_names.call_id
    and c.is_published
    and p.is_listed
    and p.status = 'active'
  order by p.name_en;
$$;

grant execute on function journal.call_partner_names(uuid) to anon, authenticated;

-- Partners a Journal manager may open a call to: memorandum in force
-- granting submissions (names only; the register stays private).
create function journal.submission_partners()
returns table (id uuid, name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name_en, p.name_ar
  from governance.partners p
  where access.has_permission_anywhere('journal.manage')
    and 'journal_submissions' = any (private.partner_grants(p.id))
  order by p.name_en;
$$;

revoke all on function journal.submission_partners() from public, anon;
grant execute on function journal.submission_partners() to authenticated;

-- A call's partners, for the Journal managers who choose them.
create policy "Journal managers read a call's partners"
  on journal.call_partners for select to authenticated
  using ((select access.has_permission_anywhere('journal.manage')));

-- The calls the caller may answer through a partner (for the submit form):
-- verified affiliation, a memorandum in force granting submissions, and
-- the call naming that partner.
create function journal.my_call_pathways()
returns table (call_id uuid, partner_id uuid, name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.call_id, p.id, p.name_en, p.name_ar
  from journal.call_partners cp
  join journal.calls c on c.id = cp.call_id
  join governance.partners p on p.id = cp.partner_id
  where c.is_published
    and private.is_affiliated((select auth.uid()), p.id, 'journal_submissions');
$$;

revoke all on function journal.my_call_pathways() from public, anon;
grant execute on function journal.my_call_pathways() to authenticated;

-- ── Submissions through a partner ──────────────────────────────────────────

-- Identity-side only: never on blind entries, so readers never see it.
alter table journal.submissions
  add column partner_id uuid references governance.partners (id) on delete set null;

create index submissions_partner_id_idx on journal.submissions (partner_id);

-- Authors name the partner when they submit (and never change it after).
grant insert (partner_id) on journal.submissions to authenticated;

comment on column journal.submissions.partner_id is
  'The partner this work came through (its author is a verified member of that partner). Seen with identities only.';

drop policy "Members submit their own work with current pledges" on journal.submissions;

create policy "Members and partners' members submit their own work with current pledges"
  on journal.submissions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select membership.has_current_pledges())
    and (
      ((select membership.is_member())
        and (partner_id is null or (select private.can_submit_through(partner_id, call_id))))
      or (partner_id is not null and (select private.can_submit_through(partner_id, call_id)))
    )
  );

-- ── Blind review: no reader with a conflict with the partner (P8.3) ────────

create or replace function journal.assign_reader(blind_entry_id uuid, reader_id uuid, read_number integer)
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
  if exists (
    select 1 from journal.blind_keys k
    join journal.submissions s on s.id = k.submission_id
    where k.blind_entry_id = entry.id
      and s.partner_id is not null
      and private.has_partner_conflict(reader_id, s.partner_id)
  ) then
    raise exception 'The reader has declared a conflict with this partner (P8.3)'
      using errcode = '22023';
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

-- ── Guest Editor ───────────────────────────────────────────────────────────

insert into access.roles (key, name_en, name_ar, is_council, spending_limit_iqd, sort) values
  ('guest_editor', 'Guest Editor', 'محرر ضيف', false, null, 135);

insert into access.role_permissions (role, permission) values
  ('guest_editor', 'journal.manage');

-- A Guest Editor is a partner's editor, for one issue, under a memorandum
-- that grants guest editing.
create function private.guard_guest_editor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'guest_editor' then
    return new;
  end if;
  if new.scope_type <> 'issue' then
    raise exception 'guest_editor_needs_issue' using errcode = '22023';
  end if;
  if not exists (
    select 1 from governance.partner_affiliations f
    where f.user_id = new.user_id
      and f.status = 'verified'
      and 'guest_editing' = any (private.partner_grants(f.partner_id))
  ) then
    raise exception 'guest_editor_needs_partner' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_guest_editor before insert or update on access.role_assignments
  for each row execute function private.guard_guest_editor();

create trigger log_activity after insert or update or delete on journal.call_partners
  for each row execute function private.log_activity();

create trigger revalidate after insert or update or delete on journal.call_partners
  for each statement execute function private.queue_revalidation('journal');

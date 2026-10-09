-- Productions: staged readings and full productions, made by the Society
-- alone or with partners (a memorandum granting `productions`) and other
-- AUIB clubs. A production moves through stages; auditions take sign-ups
-- with private panel notes; cast and crew are credited; rehearsals are
-- called; performances are SAL events. The Program Report (Form F-25,
-- section B) closes it.
--
-- Rules carried into the database:
--   * Rights first: no production reaches the performance stage, and no
--     performance is linked, until the script's rights are cleared by
--     someone other than whoever recorded them (original work: the
--     author's written consent; public domain: confirmed; licensed: the
--     license on file under library/productions).
--   * Audition notes are never visible to the person auditioning.
--   * A credited member decides whether their name is shown publicly.
--   * Hours on a production are recorded service (Form F-16), and a closed
--     production can draft certificates for its credited members (F-28),
--     signed as any other certificate.
--
-- Arabic role names are needs-native-review (PROGRESS.md).

-- ── Scope, permission and role ─────────────────────────────────────────────

alter table access.role_assignments drop constraint role_assignments_scope_type_check;
alter table access.role_assignments add constraint role_assignments_scope_type_check
  check (scope_type in ('global', 'programme', 'issue', 'campaign', 'production'));

insert into access.permissions (key, description) values
  ('productions.manage', 'Run a production: stages, rights, auditions, credits, rehearsals and performances');

insert into access.roles (key, name_en, name_ar, is_council, spending_limit_iqd, sort) values
  ('production_lead', 'Production Lead', 'قائد العمل المسرحي', false, null, 125);

insert into access.role_permissions (role, permission) values
  ('president', 'productions.manage'),
  ('vice_president', 'productions.manage'),
  ('production_lead', 'productions.manage'),
  ('production_lead', 'events.checkin'),
  ('production_lead', 'library.read');

-- ── Productions ────────────────────────────────────────────────────────────

create table programmes.productions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  programme_id uuid references core.programmes (id) on delete set null,
  kind text not null default 'staged_reading' check (kind in ('staged_reading', 'production')),
  stage text not null default 'proposal'
    check (stage in ('proposal', 'approved', 'auditions', 'rehearsals', 'tech', 'performances', 'closed', 'cancelled')),
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text not null check (char_length(title_ar) between 1 and 200),
  summary_en text check (char_length(summary_en) <= 1000),
  summary_ar text check (char_length(summary_ar) <= 1000),
  -- Who wrote the script, as credited on the page.
  playwright text check (char_length(playwright) <= 200),
  script_origin text not null default 'original'
    check (script_origin in ('original', 'public_domain', 'licensed')),
  rights_status text not null default 'pending' check (rights_status in ('pending', 'cleared')),
  -- What the rights rest on: the author's consent, the edition used, the
  -- licence holder and terms.
  rights_note text check (char_length(rights_note) <= 1000),
  rights_document_path text check (rights_document_path ~ '^productions/'),
  rights_recorded_by uuid references auth.users (id) on delete set null,
  rights_cleared_by uuid references auth.users (id) on delete set null,
  rights_cleared_at timestamptz,
  poster_path text check (poster_path ~ '^productions/'),
  is_public boolean not null default false,
  -- Program Report (Form F-25, section B).
  report_people_reached integer check (report_people_reached >= 0),
  report_money_in_iqd bigint check (report_money_in_iqd >= 0),
  report_money_out_iqd bigint check (report_money_out_iqd >= 0),
  report_what_happened text check (char_length(report_what_happened) <= 4000),
  report_lessons text check (char_length(report_lessons) <= 2000),
  report_repeat text check (char_length(report_repeat) <= 2000),
  report_signed_by uuid references auth.users (id) on delete set null,
  report_signed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rights_status <> 'cleared' or (rights_cleared_by is not null and rights_cleared_at is not null)),
  check (rights_status <> 'cleared' or script_origin <> 'licensed' or rights_document_path is not null),
  check ((report_signed_by is null) = (report_signed_at is null))
);

comment on table programmes.productions is
  'Staged readings and productions: stages, rights clearance, and the Program Report (Form F-25, section B).';

create index productions_programme_id_idx on programmes.productions (programme_id);
create index productions_public_idx on programmes.productions (is_public, stage);
create index productions_created_by_idx on programmes.productions (created_by);
create index productions_rights_recorded_by_idx on programmes.productions (rights_recorded_by);
create index productions_rights_cleared_by_idx on programmes.productions (rights_cleared_by);
create index productions_report_signed_by_idx on programmes.productions (report_signed_by);

create trigger set_updated_at before update on programmes.productions
  for each row execute function private.set_updated_at();

create function private.may_manage_production(production uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select access.has_permission('productions.manage', 'production', production);
$$;

revoke all on function private.may_manage_production(uuid) from public, anon;
grant execute on function private.may_manage_production(uuid) to authenticated;

-- Stages and rights through the table are guarded; clearing the rights,
-- signing the report and cancelling go through the RPCs below.
create function private.guard_production()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.rights_status <> 'pending' or new.rights_cleared_by is not null
        or new.report_signed_by is not null or new.stage not in ('proposal', 'approved') then
        raise exception 'production_starts_as_proposal' using errcode = '22023';
      end if;
      new.rights_recorded_by := case
        when new.rights_note is not null or new.rights_document_path is not null then auth.uid() end;
    else
      if new.rights_status is distinct from old.rights_status
        or new.rights_cleared_by is distinct from old.rights_cleared_by
        or new.rights_cleared_at is distinct from old.rights_cleared_at
        or new.report_signed_by is distinct from old.report_signed_by
        or new.report_signed_at is distinct from old.report_signed_at then
        raise exception 'through_rpc' using errcode = '42501';
      end if;
      -- Changing what the rights rest on sends them back for clearing.
      if new.script_origin is distinct from old.script_origin
        or new.rights_note is distinct from old.rights_note
        or new.rights_document_path is distinct from old.rights_document_path then
        if old.stage in ('performances', 'closed') then
          raise exception 'rights_locked' using errcode = '22023';
        end if;
        new.rights_status := 'pending';
        new.rights_cleared_by := null;
        new.rights_cleared_at := null;
        new.rights_recorded_by := auth.uid();
      end if;
      if old.stage in ('closed', 'cancelled') and new.stage is distinct from old.stage then
        raise exception 'production_finished' using errcode = '22023';
      end if;
    end if;
  end if;
  if new.stage in ('performances', 'closed') and new.rights_status <> 'cleared'
    and (tg_op = 'INSERT' or new.stage is distinct from old.stage) then
    raise exception 'rights_not_cleared' using errcode = '22023';
  end if;
  if new.report_signed_by is not null and new.stage <> 'closed' then
    raise exception 'report_after_closing' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_production before insert or update on programmes.productions
  for each row execute function private.guard_production();

-- Someone other than whoever recorded the rights clears them.
create function programmes.clear_production_rights(production_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p programmes.productions;
begin
  select * into p from programmes.productions where id = production_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.may_manage_production(p.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p.rights_recorded_by is not null and p.rights_recorded_by = auth.uid() then
    raise exception 'someone_else_clears' using errcode = '42501';
  end if;
  if p.rights_note is null and p.rights_document_path is null then
    raise exception 'rights_not_recorded' using errcode = '22023';
  end if;
  if p.script_origin = 'licensed' and p.rights_document_path is null then
    raise exception 'license_not_on_file' using errcode = '22023';
  end if;
  update programmes.productions set
    rights_status = 'cleared', rights_cleared_by = auth.uid(), rights_cleared_at = now()
  where id = p.id;
end;
$$;

-- The lead signs the Program Report once the production has closed.
create function programmes.sign_production_report(production_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p programmes.productions;
begin
  select * into p from programmes.productions where id = production_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.may_manage_production(p.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p.stage <> 'closed' then
    raise exception 'report_after_closing' using errcode = '22023';
  end if;
  if p.report_what_happened is null or p.report_lessons is null or p.report_repeat is null
    or p.report_people_reached is null then
    raise exception 'report_incomplete' using errcode = '22023';
  end if;
  update programmes.productions set report_signed_by = auth.uid(), report_signed_at = now()
  where id = p.id;
end;
$$;

-- ── Credits (cast, crew, creative team) ────────────────────────────────────

create table programmes.production_credits (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references programmes.productions (id) on delete cascade,
  -- A member, or a named person from outside (a partner's actor, another
  -- club's technician): exactly one of the two.
  user_id uuid references auth.users (id) on delete cascade,
  person_name text check (char_length(person_name) between 1 and 200),
  partner_id uuid references governance.partners (id) on delete set null,
  department text not null check (department in ('cast', 'crew', 'creative')),
  role_en text not null check (char_length(role_en) between 1 and 200),
  role_ar text check (char_length(role_ar) <= 200),
  -- Members choose this themselves (set_credit_visibility); outside people
  -- are shown when the lead has their consent.
  show_publicly boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (person_name is null))
);

create unique index production_credits_member_idx
  on programmes.production_credits (production_id, user_id, role_en) where user_id is not null;
create index production_credits_production_id_idx on programmes.production_credits (production_id, sort);
create index production_credits_user_id_idx on programmes.production_credits (user_id);
create index production_credits_partner_id_idx on programmes.production_credits (partner_id);

create function private.guard_production_credit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.user_id is not null
    and new.show_publicly is distinct from (case when tg_op = 'UPDATE' then old.show_publicly else false end) then
    raise exception 'member_chooses' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_production_credit before insert or update on programmes.production_credits
  for each row execute function private.guard_production_credit();

-- Members may see a production's auditions while it is auditioning (the
-- production row itself stays with its company).
create function private.is_auditioning(production uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from programmes.productions p where p.id = production and p.stage = 'auditions'
  );
$$;

revoke all on function private.is_auditioning(uuid) from public, anon;
grant execute on function private.is_auditioning(uuid) to authenticated;

create function private.is_credited(production uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from programmes.production_credits c
    where c.production_id = production and c.user_id = auth.uid()
  );
$$;

revoke all on function private.is_credited(uuid) from public, anon;
grant execute on function private.is_credited(uuid) to authenticated;

create function programmes.set_credit_visibility(credit_id uuid, visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update programmes.production_credits set show_publicly = visible
  where id = credit_id and user_id = auth.uid();
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ── Auditions ──────────────────────────────────────────────────────────────

create table programmes.auditions (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references programmes.productions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_en text check (char_length(location_en) <= 200),
  location_ar text check (char_length(location_ar) <= 200),
  capacity integer not null default 10 check (capacity > 0),
  -- What to prepare (a monologue, a passage from the script).
  prepare_en text check (char_length(prepare_en) <= 1000),
  prepare_ar text check (char_length(prepare_ar) <= 1000),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index auditions_production_id_idx on programmes.auditions (production_id, starts_at);

create table programmes.audition_signups (
  audition_id uuid not null references programmes.auditions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status text not null default 'signed_up'
    check (status in ('signed_up', 'cancelled', 'called_back', 'cast', 'not_cast')),
  -- The part or piece the member would like to read.
  interest text check (char_length(interest) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (audition_id, user_id)
);

create index audition_signups_user_id_idx on programmes.audition_signups (user_id);

create trigger set_updated_at before update on programmes.audition_signups
  for each row execute function private.set_updated_at();

-- The panel's notes: never readable by the person auditioning.
create table programmes.audition_notes (
  id uuid primary key default gen_random_uuid(),
  audition_id uuid not null references programmes.auditions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (author_id <> user_id)
);

create index audition_notes_audition_id_idx on programmes.audition_notes (audition_id, user_id);
create index audition_notes_user_id_idx on programmes.audition_notes (user_id);
create index audition_notes_author_id_idx on programmes.audition_notes (author_id);

create function programmes.sign_up_for_audition(audition_id uuid, interest text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  a programmes.auditions;
  p programmes.productions;
  taken integer;
begin
  if not membership.is_member() then
    raise exception 'members_only' using errcode = '42501';
  end if;
  select * into a from programmes.auditions where id = sign_up_for_audition.audition_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into p from programmes.productions where id = a.production_id;
  if p.stage <> 'auditions' or a.starts_at <= now() then
    raise exception 'auditions_closed' using errcode = '22023';
  end if;
  select count(*) into taken from programmes.audition_signups s
  where s.audition_id = a.id and s.status <> 'cancelled' and s.user_id <> auth.uid();
  if taken >= a.capacity then
    raise exception 'audition_full' using errcode = '23514';
  end if;
  insert into programmes.audition_signups (audition_id, user_id, interest)
  values (a.id, auth.uid(), nullif(trim(sign_up_for_audition.interest), ''))
  on conflict (audition_id, user_id) do update
    set status = 'signed_up', interest = excluded.interest
    where programmes.audition_signups.status in ('signed_up', 'cancelled');
end;
$$;

create function programmes.cancel_audition(audition_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update programmes.audition_signups set status = 'cancelled'
  where audition_signups.audition_id = cancel_audition.audition_id
    and user_id = auth.uid() and status = 'signed_up';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ── Rehearsals ─────────────────────────────────────────────────────────────

create table programmes.rehearsals (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references programmes.productions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_en text check (char_length(location_en) <= 200),
  location_ar text check (char_length(location_ar) <= 200),
  -- Who is called ("Act 1 cast", "Full company").
  called text check (char_length(called) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index rehearsals_production_id_idx on programmes.rehearsals (production_id, starts_at);

-- ── Performances and partners ──────────────────────────────────────────────

create table programmes.production_events (
  production_id uuid not null references programmes.productions (id) on delete cascade,
  event_id uuid not null unique references events.events (id) on delete cascade,
  primary key (production_id, event_id)
);

create function private.guard_production_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from programmes.productions p
    where p.id = new.production_id and p.rights_status = 'cleared'
  ) then
    raise exception 'rights_not_cleared' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_production_event before insert or update on programmes.production_events
  for each row execute function private.guard_production_event();

create table programmes.production_partners (
  production_id uuid not null references programmes.productions (id) on delete cascade,
  partner_id uuid not null references governance.partners (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (production_id, partner_id)
);

create index production_partners_partner_id_idx on programmes.production_partners (partner_id);

-- A partner co-produces only under a memorandum granting `productions`.
create function private.guard_production_partner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ('productions' = any (private.partner_grants(new.partner_id))) then
    raise exception 'partner_not_granted' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_production_partner before insert on programmes.production_partners
  for each row execute function private.guard_production_partner();

-- Partners a production lead may name: a memorandum in force granting
-- productions (names only).
create function programmes.production_partner_choices()
returns table (id uuid, name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name_en, p.name_ar
  from governance.partners p
  where access.has_permission_anywhere('productions.manage')
    and 'productions' = any (private.partner_grants(p.id))
  order by p.name_en;
$$;

-- ── Service hours and certificates ─────────────────────────────────────────

-- A production's lead records a credited member's hours as confirmed
-- service (one entry per member per production, updated in place).
create function programmes.record_production_service(production_id uuid, member_id uuid, hours numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p programmes.productions;
  new_id uuid;
begin
  select * into p from programmes.productions where id = record_production_service.production_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.may_manage_production(p.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if member_id = auth.uid() then
    raise exception 'not_your_own' using errcode = '42501';
  end if;
  if p.stage in ('proposal', 'approved', 'cancelled') then
    raise exception 'production_not_started' using errcode = '22023';
  end if;
  if not exists (
    select 1 from programmes.production_credits c
    where c.production_id = p.id and c.user_id = member_id
  ) then
    raise exception 'not_credited' using errcode = '22023';
  end if;
  if hours is null or hours <= 0 or hours > 24 or hours * 4 <> round(hours * 4) then
    raise exception 'invalid_hours' using errcode = '22023';
  end if;

  insert into membership.service_records (
    user_id, source, source_id, programme_id, occurred_on, activity, hours,
    status, confirmed_by, confirmed_at
  ) values (
    member_id, 'production', p.id, p.programme_id,
    (now() at time zone 'Asia/Baghdad')::date, left(p.title_en, 200), hours,
    'confirmed', auth.uid(), now()
  )
  on conflict (user_id, source, source_id) where source_id is not null
  do update set hours = excluded.hours, confirmed_by = excluded.confirmed_by, confirmed_at = now()
  returning id into new_id;
  return new_id;
end;
$$;

-- A certificate names the production it was earned on.
alter table membership.certificates
  add column production_id uuid references programmes.productions (id) on delete set null;

create index certificates_production_id_idx on membership.certificates (production_id);
create unique index certificates_production_member_idx
  on membership.certificates (production_id, user_id)
  where production_id is not null and status <> 'revoked';

-- Drafts a production certificate for each credited member of a closed
-- production who has none; the President and the Faculty Advisor then sign
-- them as any other certificate. Returns how many were drafted.
create function programmes.draft_production_certificates(production_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p programmes.productions;
  drafted integer;
begin
  if not access.has_permission('certificates.prepare') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into p from programmes.productions where id = draft_production_certificates.production_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p.stage <> 'closed' then
    raise exception 'production_not_closed' using errcode = '22023';
  end if;

  insert into membership.certificates (
    user_id, kind, role_en, role_ar, period_from, period_to, production_id, prepared_by
  )
  select distinct on (c.user_id)
    c.user_id, 'production',
    left(c.role_en || ', ' || p.title_en, 200),
    case when c.role_ar is not null then left(c.role_ar || '، ' || p.title_ar, 200) end,
    least(
      coalesce(
        (select min(r.starts_at at time zone 'Asia/Baghdad')::date
          from programmes.rehearsals r where r.production_id = p.id),
        (p.created_at at time zone 'Asia/Baghdad')::date),
      (p.updated_at at time zone 'Asia/Baghdad')::date),
    (p.updated_at at time zone 'Asia/Baghdad')::date,
    p.id, auth.uid()
  from programmes.production_credits c
  where c.production_id = p.id
    and c.user_id is not null
    and not exists (
      select 1 from membership.certificates x
      where x.production_id = p.id and x.user_id = c.user_id and x.status <> 'revoked'
    )
  order by c.user_id, c.sort, c.created_at;
  get diagnostics drafted = row_count;
  return drafted;
end;
$$;

-- ── Reads for members and the public ───────────────────────────────────────

-- Productions members can see in the Nexus: approved and onward, with
-- their open auditions.
create function programmes.member_productions()
returns table (
  id uuid, slug text, kind text, stage text, title_en text, title_ar text,
  summary_en text, summary_ar text, playwright text, poster_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.kind, p.stage, p.title_en, p.title_ar,
    p.summary_en, p.summary_ar, p.playwright, p.poster_path
  from programmes.productions p
  where membership.is_member()
    and p.stage in ('auditions', 'rehearsals', 'tech', 'performances')
  order by p.created_at desc;
$$;

-- auibsal.org/productions: public productions, never their rights,
-- auditions or report.
create function programmes.public_productions()
returns table (
  id uuid, slug text, kind text, stage text, title_en text, title_ar text,
  summary_en text, summary_ar text, playwright text, poster_path text,
  first_performance timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.kind, p.stage, p.title_en, p.title_ar,
    p.summary_en, p.summary_ar, p.playwright, p.poster_path,
    (select min(e.starts_at) from programmes.production_events pe
      join events.events e on e.id = pe.event_id
      where pe.production_id = p.id and e.status = 'published' and not e.members_only)
  from programmes.productions p
  where p.is_public and p.stage not in ('proposal', 'cancelled')
  order by p.created_at desc;
$$;

-- A public production's credits (only names that may be shown), its
-- partners and its public performances.
create function programmes.public_production_credits(production_id uuid)
returns table (department text, role_en text, role_ar text, name_en text, name_ar text, sort integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.department, c.role_en, c.role_ar,
    coalesce(c.person_name, pr.full_name_en), coalesce(c.person_name, pr.full_name_ar, pr.full_name_en),
    c.sort
  from programmes.production_credits c
  join programmes.productions p on p.id = c.production_id
  left join core.profiles pr on pr.id = c.user_id
  where c.production_id = public_production_credits.production_id
    and p.is_public and p.stage not in ('proposal', 'cancelled')
    and c.show_publicly
  order by c.department, c.sort, c.created_at;
$$;

create function programmes.public_production_partners(production_id uuid)
returns table (name_en text, name_ar text, url text)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.name_en, pa.name_ar, pa.url
  from programmes.production_partners pp
  join programmes.productions p on p.id = pp.production_id
  join governance.partners pa on pa.id = pp.partner_id
  where pp.production_id = public_production_partners.production_id
    and p.is_public and pa.is_listed and pa.status = 'active'
    and 'productions' = any (private.partner_grants(pa.id))
  order by pa.name_en;
$$;

create function programmes.public_production_events(production_id uuid)
returns table (slug text, title_en text, title_ar text, starts_at timestamptz,
  venue_en text, venue_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.slug, e.title_en, e.title_ar, e.starts_at, e.venue_en, e.venue_ar
  from programmes.production_events pe
  join programmes.productions p on p.id = pe.production_id
  join events.events e on e.id = pe.event_id
  where pe.production_id = public_production_events.production_id
    and p.is_public and p.rights_status = 'cleared'
    and e.status = 'published' and not e.members_only
  order by e.starts_at;
$$;

revoke all on function
  private.guard_production(), private.guard_production_credit(),
  private.guard_production_event(), private.guard_production_partner()
  from public, anon, authenticated;

revoke all on function
  programmes.clear_production_rights(uuid), programmes.sign_production_report(uuid),
  programmes.set_credit_visibility(uuid, boolean),
  programmes.sign_up_for_audition(uuid, text), programmes.cancel_audition(uuid),
  programmes.production_partner_choices(),
  programmes.record_production_service(uuid, uuid, numeric),
  programmes.draft_production_certificates(uuid), programmes.member_productions()
  from public, anon;

grant execute on function
  programmes.clear_production_rights(uuid), programmes.sign_production_report(uuid),
  programmes.set_credit_visibility(uuid, boolean),
  programmes.sign_up_for_audition(uuid, text), programmes.cancel_audition(uuid),
  programmes.production_partner_choices(),
  programmes.record_production_service(uuid, uuid, numeric),
  programmes.draft_production_certificates(uuid), programmes.member_productions()
  to authenticated;

grant execute on function
  programmes.public_productions(), programmes.public_production_credits(uuid),
  programmes.public_production_partners(uuid), programmes.public_production_events(uuid)
  to anon, authenticated;

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table programmes.productions enable row level security;
alter table programmes.production_credits enable row level security;
alter table programmes.auditions enable row level security;
alter table programmes.audition_signups enable row level security;
alter table programmes.audition_notes enable row level security;
alter table programmes.rehearsals enable row level security;
alter table programmes.production_events enable row level security;
alter table programmes.production_partners enable row level security;

-- Productions: their leads (and global managers), and the people credited.
create policy "Leads and the company read a production"
  on programmes.productions for select to authenticated
  using ((select private.may_manage_production(id)) or (select private.is_credited(id)));

create policy "Production managers propose productions"
  on programmes.productions for insert to authenticated
  with check ((select access.has_permission('productions.manage')));

create policy "Leads run their production"
  on programmes.productions for update to authenticated
  using ((select private.may_manage_production(id)))
  with check ((select private.may_manage_production(id)));

create policy "Production managers delete proposals"
  on programmes.productions for delete to authenticated
  using (stage = 'proposal' and (select access.has_permission('productions.manage')));

-- Credits: the lead keeps them; each member reads their own; the company
-- reads the company.
create policy "The company reads its credits"
  on programmes.production_credits for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.may_manage_production(production_id))
    or (select private.is_credited(production_id))
  );

create policy "Leads keep credits"
  on programmes.production_credits for all to authenticated
  using ((select private.may_manage_production(production_id)))
  with check ((select private.may_manage_production(production_id)));

-- Auditions: open to members while the production is auditioning.
create policy "Members read open auditions"
  on programmes.auditions for select to authenticated
  using (
    (select private.may_manage_production(production_id))
    or (
      (select membership.is_member())
      and (select private.is_auditioning(production_id))
    )
  );

create policy "Leads schedule auditions"
  on programmes.auditions for all to authenticated
  using ((select private.may_manage_production(production_id)))
  with check ((select private.may_manage_production(production_id)));

create policy "Members read their own audition sign-ups"
  on programmes.audition_signups for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from programmes.auditions a
      where a.id = audition_id and (select private.may_manage_production(a.production_id))
    )
  );

create policy "Leads decide audition sign-ups"
  on programmes.audition_signups for update to authenticated
  using (exists (
    select 1 from programmes.auditions a
    where a.id = audition_id and (select private.may_manage_production(a.production_id))
  ))
  with check (exists (
    select 1 from programmes.auditions a
    where a.id = audition_id and (select private.may_manage_production(a.production_id))
  ));

create policy "The panel keeps audition notes"
  on programmes.audition_notes for all to authenticated
  using (
    user_id <> (select auth.uid())
    and exists (
      select 1 from programmes.auditions a
      where a.id = audition_id and (select private.may_manage_production(a.production_id))
    )
  )
  with check (
    user_id <> (select auth.uid())
    and author_id = (select auth.uid())
    and exists (
      select 1 from programmes.auditions a
      where a.id = audition_id and (select private.may_manage_production(a.production_id))
    )
  );

-- Rehearsals: the lead and the company.
create policy "The company reads its rehearsals"
  on programmes.rehearsals for select to authenticated
  using (
    (select private.may_manage_production(production_id))
    or (select private.is_credited(production_id))
  );

create policy "Leads call rehearsals"
  on programmes.rehearsals for all to authenticated
  using ((select private.may_manage_production(production_id)))
  with check ((select private.may_manage_production(production_id)));

create policy "The company reads its performances"
  on programmes.production_events for select to authenticated
  using (
    (select private.may_manage_production(production_id))
    or (select private.is_credited(production_id))
  );

create policy "Leads link performances"
  on programmes.production_events for all to authenticated
  using ((select private.may_manage_production(production_id)))
  with check ((select private.may_manage_production(production_id)));

create policy "The company reads its partners"
  on programmes.production_partners for select to authenticated
  using (
    (select private.may_manage_production(production_id))
    or (select private.is_credited(production_id))
  );

create policy "Leads name partners"
  on programmes.production_partners for all to authenticated
  using ((select private.may_manage_production(production_id)))
  with check ((select private.may_manage_production(production_id)));

create policy "Third-party apps reach only their areas"
  on programmes.productions as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.production_credits as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.auditions as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.audition_signups as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.audition_notes as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.rehearsals as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.production_events as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));
create policy "Third-party apps reach only their areas"
  on programmes.production_partners as restrictive for all to authenticated
  using ((select private.client_allows('programmes')))
  with check ((select private.client_allows('programmes')));

grant select, insert, update, delete on
  programmes.productions, programmes.production_credits, programmes.auditions,
  programmes.audition_notes, programmes.rehearsals, programmes.production_events,
  programmes.production_partners to authenticated;
grant select, update (status) on programmes.audition_signups to authenticated;
grant all on
  programmes.productions, programmes.production_credits, programmes.auditions,
  programmes.audition_signups, programmes.audition_notes, programmes.rehearsals,
  programmes.production_events, programmes.production_partners to service_role;

create trigger log_activity after insert or update or delete on programmes.productions
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on programmes.production_credits
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on programmes.production_events
  for each row execute function private.log_activity();

create trigger revalidate after insert or update or delete on programmes.productions
  for each statement execute function private.queue_revalidation('productions');
create trigger revalidate after insert or update or delete on programmes.production_credits
  for each statement execute function private.queue_revalidation('productions');
create trigger revalidate after insert or update or delete on programmes.production_events
  for each statement execute function private.queue_revalidation('productions');
create trigger revalidate after insert or update or delete on programmes.production_partners
  for each statement execute function private.queue_revalidation('productions');

-- ── Files ──────────────────────────────────────────────────────────────────

-- media/productions/<file>: posters for the public page.
create policy "Production managers upload posters"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'productions'
    and (select access.has_permission_anywhere('productions.manage'))
  );

create policy "Production managers read posters"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'productions'
    and (select access.has_permission_anywhere('productions.manage'))
  );

create policy "Production managers remove posters"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'productions'
    and (select access.has_permission_anywhere('productions.manage'))
  );

-- library/productions/<random>.pdf: licenses and consents, opened through
-- apps/api (/files/rights) after RLS and productions.manage.
create policy "Production managers upload rights documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = 'productions'
    and (select access.has_permission_anywhere('productions.manage'))
  );

create policy "Production managers read rights documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = 'productions'
    and (select access.has_permission_anywhere('productions.manage'))
  );

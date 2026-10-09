-- Partnerships (Policy Manual P11, P8; Roles & Staffing: Director of
-- Partnerships & Outreach). The partners register with renewal dates, the
-- Partnership Memorandum (Form F-26) signed by the President, the Conflict
-- of Interest Declaration (Form F-18), partner affiliations for people from
-- partner organizations, and member offers from partners.
--
-- Rules carried into the database:
--   * A partner appears on auibsal.org only while it is active and has a
--     signed memorandum in force (P11.2; like documents, nothing unsigned is
--     shown as agreed).
--   * What a partnership allows on the platform (Journal submissions, member
--     offers, co-hosting, ...) comes from the grants of its signed
--     memorandum, never from the partner row alone.
--   * Whoever has declared a conflict with a partner does not sign or
--     approve its memorandum (P8.3).
--
-- Arabic role and grant names are needs-native-review (PROGRESS.md).

-- ── Permissions and roles ──────────────────────────────────────────────────

insert into access.permissions (key, description) values
  ('partners.manage', 'Keep the partners register: partners, memoranda, affiliations and member offers'),
  ('partners.sign', 'Sign partnership memoranda for the Society (Form F-26)');

insert into access.roles (key, name_en, name_ar, is_council, spending_limit_iqd, sort) values
  ('partnerships_director', 'Director of Partnerships & Outreach', 'مدير الشراكات والتواصل', true, 50000, 55);

update access.roles set requires_mfa = true where key = 'partnerships_director';

insert into access.role_permissions (role, permission) values
  ('president', 'partners.manage'),
  ('president', 'partners.sign'),
  ('vice_president', 'partners.manage'),
  ('vice_president', 'partners.sign'),
  ('partnerships_director', 'partners.manage'),
  ('partnerships_director', 'events.checkin'),
  ('partnerships_director', 'library.read'),
  ('partnerships_director', 'library.council'),
  ('partnerships_director', 'spending.request');

-- ── The partners register ──────────────────────────────────────────────────

create table governance.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 1 and 200),
  name_ar text check (char_length(name_ar) <= 200),
  kind text not null check (kind in (
    'club', 'department', 'cultural', 'publisher', 'archive', 'media',
    'business', 'foundation', 'charity', 'university', 'other'
  )),
  -- Inside AUIB, elsewhere in Iraq, or outside Iraq (Student Life is told
  -- of every partnership; international ones may need its approval).
  reach text not null default 'iraq' check (reach in ('auib', 'iraq', 'international')),
  status text not null default 'prospect'
    check (status in ('prospect', 'active', 'lapsed', 'ended')),
  url text check (url ~ '^https://'),
  -- Public description, shown only while the partner is listed.
  description_en text check (char_length(description_en) <= 1000),
  description_ar text check (char_length(description_ar) <= 1000),
  -- media/partners/<random>.<ext>
  logo_path text,
  -- Listed on auibsal.org/partners (only counts with a signed memorandum).
  is_listed boolean not null default false,
  -- The SAL person who looks after the relationship.
  lead_id uuid references auth.users (id) on delete set null,
  -- Contacts and notes stay internal (never in the public listing).
  contact_name text check (char_length(contact_name) <= 200),
  contact_role text check (char_length(contact_role) <= 200),
  contact_email text check (contact_email is null or contact_email ~ '^[^@\s]+@[^@\s]+$'),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table governance.partners is
  'The partners register kept by the Director of Partnerships (Roles & Staffing; P11).';

create index partners_lead_id_idx on governance.partners (lead_id);
create index partners_status_idx on governance.partners (status);

-- ── Partnership Memorandum (Form F-26) ─────────────────────────────────────

create table governance.partner_agreements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references governance.partners (id) on delete cascade,
  -- MOU-2026-01
  code text unique check (code ~ '^MOU-\d{4}-\d{2,3}$'),
  purpose_en text not null check (char_length(purpose_en) between 1 and 2000),
  purpose_ar text check (char_length(purpose_ar) <= 2000),
  starts_on date not null,
  ends_on date,
  -- When to review and renew (the register's renewal date).
  renew_by date,
  sal_will text check (char_length(sal_will) <= 4000),
  partner_will text check (char_length(partner_will) <= 4000),
  money text check (char_length(money) <= 4000),
  branding text check (char_length(branding) <= 4000),
  people_safety text check (char_length(people_safety) <= 4000),
  sal_contact text check (char_length(sal_contact) <= 400),
  partner_contact text check (char_length(partner_contact) <= 400),
  -- What the memorandum allows on the platform.
  grants text[] not null default '{}' check (grants <@ array[
    'journal_submissions', 'guest_editing', 'event_cohosting', 'member_offer',
    'shared_branding', 'productions', 'volunteering'
  ]),
  status text not null default 'draft' check (status in ('draft', 'signed', 'ended')),
  partner_signatory text check (char_length(partner_signatory) <= 200),
  signed_by uuid references auth.users (id) on delete set null,
  signed_at timestamptz,
  -- library/partners/<random>.pdf: the signed copy.
  signed_document_path text,
  student_life_informed_on date,
  ended_on date,
  end_reason text check (char_length(end_reason) <= 1000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (status <> 'signed' or (signed_by is not null and signed_at is not null))
);

comment on table governance.partner_agreements is
  'Partnership memoranda (Form F-26, P11.2), signed by the President.';

create index partner_agreements_partner_id_idx on governance.partner_agreements (partner_id);
create index partner_agreements_signed_by_idx on governance.partner_agreements (signed_by);
create index partner_agreements_created_by_idx on governance.partner_agreements (created_by);
create index partner_agreements_renew_by_idx on governance.partner_agreements (renew_by)
  where status = 'signed';

-- ── Conflict of Interest Declaration (Form F-18) ───────────────────────────

create table governance.conflict_declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  semester_id uuid references core.semesters (id) on delete set null,
  role_title text check (char_length(role_title) <= 200),
  nothing_to_declare boolean not null default false,
  signed_at timestamptz not null default now(),
  -- The General Secretary records receipt.
  received_by uuid references auth.users (id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table governance.conflict_declarations is
  'Conflict of Interest Declarations (Form F-18, P8): each role holder, each semester.';

create index conflict_declarations_user_id_idx on governance.conflict_declarations (user_id);
create index conflict_declarations_semester_id_idx on governance.conflict_declarations (semester_id);
create index conflict_declarations_received_by_idx on governance.conflict_declarations (received_by);

create table governance.conflict_items (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references governance.conflict_declarations (id) on delete cascade,
  -- The five questions on F-18.
  kind text not null check (kind in (
    'close_person_applying', 'supplier', 'partner_role', 'value_received', 'other'
  )),
  -- Set when the conflict concerns a partner: that person then cannot sign
  -- or approve the partner's memorandum, and (Journal) is not assigned to
  -- read submissions that came through that partner.
  partner_id uuid references governance.partners (id) on delete set null,
  what text not null check (char_length(what) between 1 and 1000),
  affects text check (char_length(affects) <= 1000),
  handling text check (char_length(handling) <= 1000),
  -- A conflict that no longer applies stays on record, closed.
  closed_on date,
  created_at timestamptz not null default now()
);

create index conflict_items_declaration_id_idx on governance.conflict_items (declaration_id);
create index conflict_items_partner_id_idx on governance.conflict_items (partner_id);

-- ── Affiliations: people from partner organizations ───────────────────────

create table governance.partner_affiliations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references governance.partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'verified', 'declined', 'ended')),
  -- What the person told us (their role or membership number there).
  note text check (char_length(note) <= 500),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

comment on table governance.partner_affiliations is
  'People who belong to a partner organization, verified by the Society. Never shared with partners.';

create index partner_affiliations_user_id_idx on governance.partner_affiliations (user_id);
create index partner_affiliations_decided_by_idx on governance.partner_affiliations (decided_by);

-- ── Member offers ──────────────────────────────────────────────────────────

create table governance.member_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references governance.partners (id) on delete cascade,
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text check (char_length(title_ar) <= 200),
  -- How to redeem it: there are no payments on the platform.
  details_en text not null check (char_length(details_en) between 1 and 2000),
  details_ar text check (char_length(details_ar) <= 2000),
  code text check (char_length(code) <= 60),
  starts_on date not null default current_date,
  ends_on date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

comment on table governance.member_offers is
  'Offers from partners for verified members only (needs a signed memorandum granting member_offer).';

create index member_offers_partner_id_idx on governance.member_offers (partner_id);

-- ── Helpers ────────────────────────────────────────────────────────────────

-- What the partner's memoranda in force allow today.
create function private.partner_grants(partner uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct g), '{}')
  from governance.partner_agreements a
  join governance.partners p on p.id = a.partner_id
  cross join lateral unnest(a.grants) as g
  where a.partner_id = partner
    and p.status = 'active'
    and a.status = 'signed'
    and a.starts_on <= current_date
    and (a.ends_on is null or a.ends_on >= current_date);
$$;

-- True when the person has an open declared conflict with the partner.
create function private.has_partner_conflict(uid uuid, partner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from governance.conflict_items i
    join governance.conflict_declarations d on d.id = i.declaration_id
    where d.user_id = uid
      and i.partner_id = partner
      and (i.closed_on is null or i.closed_on > current_date)
  );
$$;

-- True when the person is a verified member of a partner whose memorandum
-- in force grants `grant_key`.
create function private.is_affiliated(uid uuid, partner uuid, grant_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from governance.partner_affiliations f
    where f.user_id = uid and f.partner_id = partner and f.status = 'verified'
  ) and grant_key = any (private.partner_grants(partner));
$$;

revoke all on function private.partner_grants(uuid), private.has_partner_conflict(uuid, uuid),
  private.is_affiliated(uuid, uuid, text) from public, anon, authenticated;
-- Row Level Security on member offers asks what a partner's memorandum
-- grants (the grant keys only, nothing personal).
grant execute on function private.partner_grants(uuid) to authenticated;

-- The public listing on auibsal.org/partners: active, listed, and with a
-- signed memorandum in force. Public columns only.
create function governance.public_partners()
returns table (
  slug text, name_en text, name_ar text, kind text, reach text, url text,
  description_en text, description_ar text, logo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.name_en, p.name_ar, p.kind, p.reach, p.url,
    p.description_en, p.description_ar, p.logo_path
  from governance.partners p
  where p.status = 'active'
    and p.is_listed
    and exists (
      select 1 from governance.partner_agreements a
      where a.partner_id = p.id
        and a.status = 'signed'
        and a.starts_on <= current_date
        and (a.ends_on is null or a.ends_on >= current_date)
    )
  order by p.name_en;
$$;

grant execute on function governance.public_partners() to anon, authenticated;

-- Partners a signed-in person may say they belong to (active, with a
-- memorandum in force), for the affiliation request in Profile.
create function governance.joinable_partners()
returns table (id uuid, name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name_en, p.name_ar
  from governance.partners p
  where p.status = 'active'
    and cardinality(private.partner_grants(p.id)) > 0
  order by p.name_en;
$$;

revoke all on function governance.joinable_partners() from public, anon;
grant execute on function governance.joinable_partners() to authenticated;

-- Partner names for a role holder's Conflict of Interest Declaration (F-18
-- asks about roles in "another club or organisation we partner with"),
-- prospects included. Names only; the register itself stays private.
create function governance.declarable_partners()
returns table (id uuid, name_en text, name_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name_en, p.name_ar
  from governance.partners p
  where p.status <> 'ended'
    and exists (
      select 1 from access.role_assignments ra
      where ra.user_id = (select auth.uid())
        and ra.starts_at <= now()
        and (ra.ends_at is null or ra.ends_at > now())
    )
  order by p.name_en;
$$;

revoke all on function governance.declarable_partners() from public, anon;
grant execute on function governance.declarable_partners() to authenticated;

-- Sign a draft memorandum (F-26: "For SAL: President"). Refused to anyone
-- with a declared conflict with the partner (P8.3).
create function governance.sign_partner_agreement(
  agreement_id uuid,
  partner_signatory text,
  signed_document_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a governance.partner_agreements;
begin
  if not (select access.has_permission('partners.sign')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into a from governance.partner_agreements where id = agreement_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'draft' then
    raise exception 'not_draft' using errcode = '22023';
  end if;
  if private.has_partner_conflict(auth.uid(), a.partner_id) then
    raise exception 'conflict_declared' using errcode = '42501';
  end if;
  if coalesce(trim(sign_partner_agreement.partner_signatory), '') = ''
    or coalesce(trim(sign_partner_agreement.signed_document_path), '') = '' then
    raise exception 'missing_signature' using errcode = '22023';
  end if;
  if sign_partner_agreement.signed_document_path !~ '^partners/' then
    raise exception 'invalid_document' using errcode = '22023';
  end if;

  update governance.partner_agreements set
    status = 'signed',
    partner_signatory = trim(sign_partner_agreement.partner_signatory),
    signed_document_path = sign_partner_agreement.signed_document_path,
    signed_by = auth.uid(),
    signed_at = now()
  where id = agreement_id;

  update governance.partners set status = 'active'
  where id = a.partner_id and status = 'prospect';
end;
$$;

revoke all on function governance.sign_partner_agreement(uuid, text, text) from public, anon;
grant execute on function governance.sign_partner_agreement(uuid, text, text) to authenticated;

-- A signed memorandum is the record of what was agreed: once signed, only
-- the operational fields change (renewal, Student Life notice, ending).
create function private.guard_signed_agreement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('signed', 'ended') and (
    new.partner_id is distinct from old.partner_id
    or new.purpose_en is distinct from old.purpose_en
    or new.purpose_ar is distinct from old.purpose_ar
    or new.starts_on is distinct from old.starts_on
    or new.sal_will is distinct from old.sal_will
    or new.partner_will is distinct from old.partner_will
    or new.money is distinct from old.money
    or new.branding is distinct from old.branding
    or new.people_safety is distinct from old.people_safety
    or new.grants is distinct from old.grants
    or new.partner_signatory is distinct from old.partner_signatory
    or new.signed_by is distinct from old.signed_by
    or new.signed_at is distinct from old.signed_at
    or new.signed_document_path is distinct from old.signed_document_path
  ) then
    raise exception 'agreement_signed' using errcode = '22023';
  end if;
  if old.status = 'ended' and new.status <> 'ended' then
    raise exception 'agreement_ended' using errcode = '22023';
  end if;
  -- Signing goes through sign_partner_agreement (permission and conflict
  -- checks), which runs as its owner; a direct update by a member may not.
  if old.status = 'draft' and new.status = 'signed' and current_user = 'authenticated' then
    raise exception 'sign_through_rpc' using errcode = '42501';
  end if;
  if old.status = 'draft' and new.status = 'ended' then
    raise exception 'draft_cannot_end' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_signed_agreement before update on governance.partner_agreements
  for each row execute function private.guard_signed_agreement();

-- Drafts are written as drafts; signing is the RPC's job.
create function private.agreements_start_as_drafts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft' or new.signed_by is not null or new.signed_at is not null then
    raise exception 'agreement_starts_draft' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger agreements_start_as_drafts before insert on governance.partner_agreements
  for each row execute function private.agreements_start_as_drafts();

-- Affiliation decisions record who decided; members only ever create
-- pending requests for themselves.
create function private.stamp_affiliation_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and not (select access.has_permission('partners.manage')) then
      raise exception 'affiliation_starts_pending' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status in ('verified', 'declined') then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger stamp_affiliation_decision before insert or update on governance.partner_affiliations
  for each row execute function private.stamp_affiliation_decision();

-- The General Secretary's receipt of a declaration.
create function private.stamp_conflict_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.received_at is not null and old.received_at is null then
    new.received_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger stamp_conflict_receipt before update on governance.conflict_declarations
  for each row execute function private.stamp_conflict_receipt();

-- ── Housekeeping triggers ──────────────────────────────────────────────────

create trigger set_updated_at before update on governance.partners
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on governance.partner_agreements
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on governance.conflict_declarations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on governance.partner_affiliations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on governance.member_offers
  for each row execute function private.set_updated_at();

create trigger log_activity after insert or update or delete on governance.partners
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.partner_agreements
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.partner_affiliations
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.member_offers
  for each row execute function private.log_activity();

create trigger revalidate after insert or update or delete on governance.partners
  for each statement execute function private.queue_revalidation('partners');
create trigger revalidate after insert or update or delete on governance.partner_agreements
  for each statement execute function private.queue_revalidation('partners');

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table governance.partners enable row level security;
alter table governance.partner_agreements enable row level security;
alter table governance.conflict_declarations enable row level security;
alter table governance.conflict_items enable row level security;
alter table governance.partner_affiliations enable row level security;
alter table governance.member_offers enable row level security;

create policy "Partnership managers read the register"
  on governance.partners for select to authenticated
  using (
    (select access.has_permission('partners.manage'))
    or (select access.has_permission('partners.sign'))
    or (select access.has_permission('governance.manage'))
  );

create policy "Partnership managers keep the register"
  on governance.partners for all to authenticated
  using ((select access.has_permission('partners.manage')))
  with check ((select access.has_permission('partners.manage')));

create policy "Partnership managers read memoranda"
  on governance.partner_agreements for select to authenticated
  using (
    (select access.has_permission('partners.manage'))
    or (select access.has_permission('partners.sign'))
    or (select access.has_permission('governance.manage'))
  );

create policy "Partnership managers draft memoranda"
  on governance.partner_agreements for insert to authenticated
  with check ((select access.has_permission('partners.manage')));

create policy "Partnership managers update memoranda"
  on governance.partner_agreements for update to authenticated
  using ((select access.has_permission('partners.manage')))
  with check ((select access.has_permission('partners.manage')));

create policy "Partnership managers delete draft memoranda"
  on governance.partner_agreements for delete to authenticated
  using (status = 'draft' and (select access.has_permission('partners.manage')));

create policy "Members read their own declarations"
  on governance.conflict_declarations for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select access.has_permission('governance.manage'))
    or (select access.has_permission('partners.sign'))
  );

create policy "Members declare for themselves"
  on governance.conflict_declarations for insert to authenticated
  with check (user_id = (select auth.uid()) and received_at is null);

create policy "The General Secretary records receipt"
  on governance.conflict_declarations for update to authenticated
  using ((select access.has_permission('governance.manage')))
  with check ((select access.has_permission('governance.manage')));

create policy "Members read the items they declared"
  on governance.conflict_items for select to authenticated
  using (exists (
    select 1 from governance.conflict_declarations d
    where d.id = declaration_id
      and (
        d.user_id = (select auth.uid())
        or (select access.has_permission('governance.manage'))
        or (select access.has_permission('partners.sign'))
      )
  ));

create policy "Members add items to their own declarations"
  on governance.conflict_items for insert to authenticated
  with check (exists (
    select 1 from governance.conflict_declarations d
    where d.id = declaration_id and d.user_id = (select auth.uid())
  ));

create policy "Members close their own items"
  on governance.conflict_items for update to authenticated
  using (exists (
    select 1 from governance.conflict_declarations d
    where d.id = declaration_id and d.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from governance.conflict_declarations d
    where d.id = declaration_id and d.user_id = (select auth.uid())
  ));

create policy "Members read their own affiliations"
  on governance.partner_affiliations for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select access.has_permission('partners.manage'))
  );

create policy "Members ask to be affiliated"
  on governance.partner_affiliations for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and status = 'pending')
    or (select access.has_permission('partners.manage'))
  );

create policy "Partnership managers decide affiliations"
  on governance.partner_affiliations for update to authenticated
  using ((select access.has_permission('partners.manage')))
  with check ((select access.has_permission('partners.manage')));

create policy "Members withdraw their own requests"
  on governance.partner_affiliations for delete to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'pending')
    or (select access.has_permission('partners.manage'))
  );

create policy "Verified members read current offers"
  on governance.member_offers for select to authenticated
  using (
    (
      is_published
      and starts_on <= current_date
      and (ends_on is null or ends_on >= current_date)
      and (select membership.is_member())
      and 'member_offer' = any (private.partner_grants(partner_id))
    )
    or (select access.has_permission('partners.manage'))
  );

create policy "Partnership managers keep offers"
  on governance.member_offers for all to authenticated
  using ((select access.has_permission('partners.manage')))
  with check ((select access.has_permission('partners.manage')));

-- Partnership managers see the names of people who asked to be affiliated
-- (usually not AUIB-verified, so otherwise hidden), and no one else.
create policy "Partnership managers read affiliation requesters"
  on core.profiles for select to authenticated
  using (
    (select access.has_permission('partners.manage'))
    and exists (
      select 1 from governance.partner_affiliations f where f.user_id = profiles.id
    )
  );

-- Governance is never granted to third-party apps (20261008001500).
create policy "Third-party apps reach only their areas"
  on governance.partners as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));
create policy "Third-party apps reach only their areas"
  on governance.partner_agreements as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));
create policy "Third-party apps reach only their areas"
  on governance.conflict_declarations as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));
create policy "Third-party apps reach only their areas"
  on governance.conflict_items as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));
create policy "Third-party apps reach only their areas"
  on governance.partner_affiliations as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));
create policy "Third-party apps reach only their areas"
  on governance.member_offers as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select, insert, update, delete on governance.partners, governance.partner_agreements,
  governance.conflict_declarations, governance.conflict_items,
  governance.partner_affiliations, governance.member_offers to authenticated;
grant all on governance.partners, governance.partner_agreements,
  governance.conflict_declarations, governance.conflict_items,
  governance.partner_affiliations, governance.member_offers to service_role;

-- ── Files ──────────────────────────────────────────────────────────────────

-- media/partners/<random>.<ext>: partner logos for the public listing.
create policy "Partnership managers upload partner logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'partners'
    and (select access.has_permission('partners.manage'))
  );

create policy "Partnership managers read partner logos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'partners'
    and (select access.has_permission('partners.manage'))
  );

create policy "Partnership managers remove partner logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'partners'
    and (select access.has_permission('partners.manage'))
  );

-- library/partners/<random>.pdf: signed memoranda, opened through apps/api
-- (/files/agreement) after RLS on governance.partner_agreements.
create policy "Partnership officers upload signed memoranda"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = 'partners'
    and (
      (select access.has_permission('partners.manage'))
      or (select access.has_permission('partners.sign'))
    )
  );

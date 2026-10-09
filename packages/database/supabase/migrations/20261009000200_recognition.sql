-- Recognition (Bylaws B4): recorded service and certificates.
--
--   * Service records are the Volunteer Hours Log (Form F-16): hours from
--     shifts a program manager marks as worked, from event staffing, and
--     entries members log themselves, each confirmed by someone else.
--     They count towards certificates of service and Fellowship ("at least
--     forty hours of recorded service in an academic year", B4.1).
--   * Certificates of Service (Form F-28, B4.5) and the Fellowship and
--     Honorary Membership certificates (B4.2, B4.4) are prepared in the
--     Nexus and issued only once both the President and the Faculty
--     Advisor have signed. Fellowship and Honorary Membership need the
--     adopted Council resolution. A volunteer certificate (hours, not a
--     term) is not in the Bylaws: it stays off until the Council switches
--     `features.volunteer_certificates` on.
--   * Anyone with a certificate's code can check it at auibsal.org/verify.
--
-- Arabic certificate text is written for the platform (needs-native-review).

-- ── Permissions ────────────────────────────────────────────────────────────

insert into access.permissions (key, description) values
  ('certificates.prepare', 'Prepare certificates of service, Fellowship and Honorary Membership'),
  ('certificates.sign', 'Sign certificates for the Society (President)'),
  ('certificates.countersign', 'Countersign certificates (Faculty Advisor)');

insert into access.role_permissions (role, permission) values
  ('president', 'certificates.prepare'),
  ('president', 'certificates.sign'),
  ('vice_president', 'certificates.prepare'),
  ('general_secretary', 'certificates.prepare'),
  ('faculty_advisor', 'certificates.countersign');

insert into core.settings (key, value, is_public, description) values
  ('features.volunteer_certificates', 'false', true,
   'Certificates for volunteer hours (not in the Bylaws). Off until the Council decides.');

-- ── Service records (Form F-16) ────────────────────────────────────────────

create table membership.service_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Where the hours come from. `source_id` is the shift, event or
  -- production; a member's own entry has none.
  source text not null default 'manual'
    check (source in ('manual', 'shift', 'event', 'production')),
  source_id uuid,
  programme_id uuid references core.programmes (id) on delete set null,
  occurred_on date not null,
  activity text not null check (char_length(activity) between 1 and 200),
  what text check (char_length(what) <= 1000),
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  reject_reason text check (char_length(reject_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source = 'manual' or source_id is not null),
  check (status <> 'confirmed' or confirmed_by is not null),
  check (confirmed_by is distinct from user_id)
);

comment on table membership.service_records is
  'Recorded service (Form F-16, B4.1): hours from shifts, events and members'' own entries, confirmed by someone else.';

create unique index service_records_source_idx
  on membership.service_records (user_id, source, source_id) where source_id is not null;
create index service_records_user_id_idx on membership.service_records (user_id, occurred_on);
create index service_records_programme_id_idx on membership.service_records (programme_id);
create index service_records_confirmed_by_idx on membership.service_records (confirmed_by);
create index service_records_pending_idx on membership.service_records (status) where status = 'pending';

-- Who may confirm a record: member managers anywhere, program managers for
-- their own program. Never the person who did the work.
create function private.may_confirm_service(record membership.service_records)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select record.user_id is distinct from auth.uid()
    and (
      access.has_permission('members.manage')
      or (record.programme_id is not null
        and access.has_permission('programmes.manage', 'programme', record.programme_id))
    );
$$;

revoke all on function private.may_confirm_service(membership.service_records) from public, anon;
grant execute on function private.may_confirm_service(membership.service_records) to authenticated;

-- Members log their own hours as pending; only the confirm RPC and the
-- shift and event RPCs (which run as their owner) confirm.
create function private.guard_service_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.source <> 'manual' or new.status <> 'pending' or new.confirmed_by is not null then
        raise exception 'log_as_pending' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if old.status <> 'pending' or new.status <> 'pending'
        or new.confirmed_by is distinct from old.confirmed_by
        or new.user_id is distinct from old.user_id
        or new.source is distinct from old.source then
        raise exception 'confirm_through_rpc' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_service_record before insert or update on membership.service_records
  for each row execute function private.guard_service_record();

create function membership.confirm_service(record_id uuid, approve boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r membership.service_records;
begin
  select * into r from membership.service_records where id = record_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.may_confirm_service(r) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'already_decided' using errcode = '22023';
  end if;
  update membership.service_records set
    status = case when approve then 'confirmed' else 'rejected' end,
    confirmed_by = case when approve then auth.uid() end,
    confirmed_at = now(),
    reject_reason = case when approve then null else nullif(trim(reason), '') end
  where id = record_id;
end;
$$;

-- A program manager marks a past shift as worked: the shift's length is
-- recorded as confirmed service.
create function membership.record_shift_service(shift_id uuid, member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s programmes.shifts;
  r programmes.rotas;
  new_id uuid;
begin
  select * into s from programmes.shifts where id = record_shift_service.shift_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into r from programmes.rotas where id = s.rota_id;
  if not access.has_permission('programmes.manage', 'programme', r.programme_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if member_id = auth.uid() then
    raise exception 'not_your_own' using errcode = '42501';
  end if;
  if s.ends_at > now() then
    raise exception 'shift_not_over' using errcode = '22023';
  end if;
  if not exists (
    select 1 from programmes.shift_signups su
    where su.shift_id = s.id and su.user_id = member_id and su.status <> 'cancelled'
  ) then
    raise exception 'not_signed_up' using errcode = '22023';
  end if;

  insert into membership.service_records (
    user_id, source, source_id, programme_id, occurred_on, activity, what, hours,
    status, confirmed_by, confirmed_at
  ) values (
    member_id, 'shift', s.id, r.programme_id,
    (s.starts_at at time zone 'Asia/Baghdad')::date,
    left(r.title_en || ' · ' || s.role_en, 200), null,
    least(24, greatest(0.25, round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0 * 4) / 4)),
    'confirmed', auth.uid(), now()
  )
  on conflict (user_id, source, source_id) where source_id is not null do nothing
  returning id into new_id;
  return new_id;
end;
$$;

-- An events manager records hours for someone on an event's staff.
create function membership.record_event_service(event_id uuid, member_id uuid, hours numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e events.events;
  new_id uuid;
begin
  select * into e from events.events where id = record_event_service.event_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (
    access.has_permission('events.manage')
    or (e.programme_id is not null and access.has_permission('events.manage', 'programme', e.programme_id))
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if member_id = auth.uid() then
    raise exception 'not_your_own' using errcode = '42501';
  end if;
  if e.starts_at > now() then
    raise exception 'event_not_started' using errcode = '22023';
  end if;
  if not exists (
    select 1 from events.event_staff st where st.event_id = e.id and st.user_id = member_id
  ) then
    raise exception 'not_on_staff' using errcode = '22023';
  end if;
  if hours is null or hours <= 0 or hours > 24 then
    raise exception 'invalid_hours' using errcode = '22023';
  end if;

  insert into membership.service_records (
    user_id, source, source_id, programme_id, occurred_on, activity, hours,
    status, confirmed_by, confirmed_at
  ) values (
    member_id, 'event', e.id, e.programme_id,
    (e.starts_at at time zone 'Asia/Baghdad')::date, left(e.title_en, 200), hours,
    'confirmed', auth.uid(), now()
  )
  on conflict (user_id, source, source_id) where source_id is not null
  do update set hours = excluded.hours, confirmed_by = excluded.confirmed_by, confirmed_at = now()
  returning id into new_id;
  return new_id;
end;
$$;

-- The academic year runs from September 1 (Baghdad time).
create function private.academic_year_start(on_date date default (now() at time zone 'Asia/Baghdad')::date)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    case when extract(month from on_date) >= 9 then extract(year from on_date)::int
      else extract(year from on_date)::int - 1 end,
    9, 1);
$$;

-- Confirmed hours in the academic year that contains `on_date`.
create function membership.service_hours(uid uuid default auth.uid(), on_date date default null)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.may_read_member(uid) then (
    select coalesce(sum(hours), 0)
    from membership.service_records
    where user_id = uid
      and status = 'confirmed'
      and occurred_on >= private.academic_year_start(coalesce(on_date, (now() at time zone 'Asia/Baghdad')::date))
      and occurred_on < private.academic_year_start(coalesce(on_date, (now() at time zone 'Asia/Baghdad')::date)) + interval '1 year'
  ) end;
$$;

-- For member managers: everyone's confirmed hours this academic year,
-- with the B4.1 threshold for a Fellowship nomination.
create function membership.service_totals()
returns table (user_id uuid, full_name_en text, full_name_ar text, hours numeric, fellowship_eligible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, p.full_name_en, p.full_name_ar, sum(r.hours),
    sum(r.hours) >= 40
  from membership.service_records r
  join core.profiles p on p.id = r.user_id
  where access.has_permission('members.manage')
    and r.status = 'confirmed'
    and r.occurred_on >= private.academic_year_start()
  group by r.user_id, p.full_name_en, p.full_name_ar
  order by sum(r.hours) desc;
$$;

revoke all on function membership.confirm_service(uuid, boolean, text),
  membership.record_shift_service(uuid, uuid), membership.record_event_service(uuid, uuid, numeric),
  membership.service_hours(uuid, date), membership.service_totals() from public, anon;
grant execute on function membership.confirm_service(uuid, boolean, text),
  membership.record_shift_service(uuid, uuid), membership.record_event_service(uuid, uuid, numeric),
  membership.service_hours(uuid, date), membership.service_totals() to authenticated;

-- ── Certificates (Form F-28; B4.2, B4.4, B4.5) ─────────────────────────────

create table membership.certificates (
  id uuid primary key default gen_random_uuid(),
  -- SAL-2026-001, given when the certificate is issued.
  serial text unique check (serial ~ '^SAL-\d{4}-\d{3,}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('service', 'fellowship', 'honorary', 'volunteer', 'production', 'partner')),
  -- "served the Society as ___" (service, production, partner).
  role_en text check (char_length(role_en) <= 200),
  role_ar text check (char_length(role_ar) <= 200),
  period_from date,
  period_to date,
  -- Fellowship: "for ___"; Honorary Membership: "in recognition of ___".
  citation_en text check (char_length(citation_en) <= 500),
  citation_ar text check (char_length(citation_ar) <= 500),
  hours numeric(6, 2) check (hours > 0),
  partner_id uuid references governance.partners (id) on delete set null,
  resolution_id uuid references governance.resolutions (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'revoked')),
  president_signed_by uuid references auth.users (id) on delete set null,
  president_signed_at timestamptz,
  advisor_signed_by uuid references auth.users (id) on delete set null,
  advisor_signed_at timestamptz,
  issued_at timestamptz,
  -- What a verifier types or follows: auibsal.org/verify/<code>.
  verification_code text not null unique
    default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  revoked_at timestamptz,
  revoke_reason text check (char_length(revoke_reason) <= 500),
  prepared_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_to is null or period_from is null or period_to >= period_from),
  check (kind not in ('service', 'production', 'partner') or (role_en is not null and period_from is not null)),
  check (kind not in ('fellowship', 'honorary') or (citation_en is not null and resolution_id is not null)),
  check (kind <> 'volunteer' or hours is not null),
  check (kind <> 'partner' or partner_id is not null),
  check (status <> 'issued' or (serial is not null and issued_at is not null
    and president_signed_by is not null and advisor_signed_by is not null)),
  check (status <> 'revoked' or revoked_at is not null)
);

comment on table membership.certificates is
  'Certificates of service (F-28), Fellowship and Honorary Membership (B4), issued once the President and the Faculty Advisor have signed.';

create index certificates_user_id_idx on membership.certificates (user_id);
create index certificates_partner_id_idx on membership.certificates (partner_id);
create index certificates_resolution_id_idx on membership.certificates (resolution_id);
create index certificates_president_signed_by_idx on membership.certificates (president_signed_by);
create index certificates_advisor_signed_by_idx on membership.certificates (advisor_signed_by);
create index certificates_prepared_by_idx on membership.certificates (prepared_by);

-- Drafts only, through Row Level Security; signing, issuing and revoking go
-- through the RPCs below (they run as their owner).
create function private.guard_certificate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.president_signed_by is not null or new.advisor_signed_by is not null
      or new.serial is not null then
      raise exception 'certificate_starts_draft' using errcode = '22023';
    end if;
  elsif current_user = 'authenticated' then
    if old.status <> 'draft'
      or new.status is distinct from old.status
      or new.serial is distinct from old.serial
      or new.president_signed_by is distinct from old.president_signed_by
      or new.advisor_signed_by is distinct from old.advisor_signed_by
      or new.verification_code is distinct from old.verification_code then
      raise exception 'certificate_locked' using errcode = '42501';
    end if;
    -- Editing a draft after a signature clears nothing silently: refuse.
    if old.president_signed_by is not null or old.advisor_signed_by is not null then
      raise exception 'certificate_signed' using errcode = '22023';
    end if;
  end if;
  if new.kind = 'volunteer'
    and not coalesce((private.setting('features.volunteer_certificates') #>> '{}')::boolean, false) then
    raise exception 'volunteer_certificates_off' using errcode = '22023';
  end if;
  if new.kind in ('fellowship', 'honorary') and new.resolution_id is not null and not exists (
    select 1 from governance.resolutions res where res.id = new.resolution_id and res.status = 'adopted'
  ) then
    raise exception 'resolution_not_adopted' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger guard_certificate before insert or update on membership.certificates
  for each row execute function private.guard_certificate();

-- The President signs (certificates.sign) and the Faculty Advisor
-- countersigns (certificates.countersign), in either order; the second
-- signature issues the certificate with the next serial for the year.
-- Nobody signs their own certificate.
create function membership.sign_certificate(certificate_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c membership.certificates;
  year_text text;
  next_number integer;
begin
  select * into c from membership.certificates where id = certificate_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if c.status <> 'draft' then
    raise exception 'not_draft' using errcode = '22023';
  end if;
  if c.user_id = auth.uid() then
    raise exception 'not_your_own' using errcode = '42501';
  end if;

  if access.has_permission('certificates.sign') and c.president_signed_by is null then
    update membership.certificates
    set president_signed_by = auth.uid(), president_signed_at = now()
    where id = certificate_id;
  elsif access.has_permission('certificates.countersign') and c.advisor_signed_by is null then
    update membership.certificates
    set advisor_signed_by = auth.uid(), advisor_signed_at = now()
    where id = certificate_id;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into c from membership.certificates where id = certificate_id;
  if c.president_signed_by is not null and c.advisor_signed_by is not null then
    perform pg_advisory_xact_lock(hashtext('membership.certificates.serial'));
    year_text := to_char(now() at time zone 'Asia/Baghdad', 'YYYY');
    select coalesce(max(split_part(serial, '-', 3)::int), 0) + 1 into next_number
    from membership.certificates where serial like 'SAL-' || year_text || '-%';
    update membership.certificates set
      status = 'issued',
      issued_at = now(),
      serial = 'SAL-' || year_text || '-' || lpad(next_number::text, 3, '0')
    where id = certificate_id;
    return 'issued';
  end if;
  return 'signed';
end;
$$;

create function membership.revoke_certificate(certificate_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not access.has_permission('certificates.sign') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(trim(reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update membership.certificates
  set status = 'revoked', revoked_at = now(), revoke_reason = trim(reason)
  where id = certificate_id and status = 'issued';
  if not found then
    raise exception 'not_issued' using errcode = '22023';
  end if;
end;
$$;

-- What a verifier sees for a code: issued or revoked certificates only.
create function membership.verify_certificate(code text)
returns table (
  serial text, kind text, status text, holder_en text, holder_ar text,
  role_en text, role_ar text, period_from date, period_to date,
  citation_en text, citation_ar text, hours numeric,
  partner_en text, partner_ar text, issued_at timestamptz, revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.serial, c.kind, c.status, p.full_name_en, p.full_name_ar,
    c.role_en, c.role_ar, c.period_from, c.period_to,
    c.citation_en, c.citation_ar, c.hours,
    pt.name_en, pt.name_ar, c.issued_at, c.revoked_at
  from membership.certificates c
  join core.profiles p on p.id = c.user_id
  left join governance.partners pt on pt.id = c.partner_id
  where c.verification_code = lower(trim(verify_certificate.code))
    and c.status in ('issued', 'revoked');
$$;

-- Names of the people who signed (for the printed certificate).
create function membership.certificate_signers(certificate_id uuid)
returns table (president_en text, president_ar text, advisor_en text, advisor_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.full_name_en, pp.full_name_ar, ap.full_name_en, ap.full_name_ar
  from membership.certificates c
  left join core.profiles pp on pp.id = c.president_signed_by
  left join core.profiles ap on ap.id = c.advisor_signed_by
  where c.id = certificate_id
    and (
      c.user_id = (select auth.uid())
      or access.has_permission('certificates.prepare')
      or access.has_permission('certificates.sign')
      or access.has_permission('certificates.countersign')
    );
$$;

revoke all on function membership.sign_certificate(uuid), membership.revoke_certificate(uuid, text),
  membership.certificate_signers(uuid) from public, anon;
grant execute on function membership.sign_certificate(uuid), membership.revoke_certificate(uuid, text),
  membership.certificate_signers(uuid) to authenticated;
revoke all on function membership.verify_certificate(text) from public;
grant execute on function membership.verify_certificate(text) to anon, authenticated;

-- ── Housekeeping ───────────────────────────────────────────────────────────

create trigger set_updated_at before update on membership.service_records
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on membership.certificates
  for each row execute function private.set_updated_at();

create trigger log_activity after insert or update or delete on membership.service_records
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on membership.certificates
  for each row execute function private.log_activity();

create trigger revalidate after update on membership.certificates
  for each statement execute function private.queue_revalidation('certificates');

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table membership.service_records enable row level security;
alter table membership.certificates enable row level security;

create policy "Members read their own service"
  on membership.service_records for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select access.has_permission('members.manage'))
    or (programme_id is not null
      and (select access.has_permission('programmes.manage', 'programme', programme_id)))
  );

create policy "Members log their own hours"
  on membership.service_records for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'manual' and status = 'pending');

create policy "Members edit their own pending hours"
  on membership.service_records for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Members withdraw their own pending hours"
  on membership.service_records for delete to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'pending')
    or (select access.has_permission('members.manage'))
    or (source = 'shift' and programme_id is not null
      and (select access.has_permission('programmes.manage', 'programme', programme_id)))
  );

create policy "Holders read their own certificates"
  on membership.certificates for select to authenticated
  using (
    (user_id = (select auth.uid()) and status <> 'draft')
    or (select access.has_permission('certificates.prepare'))
    or (select access.has_permission('certificates.sign'))
    or (select access.has_permission('certificates.countersign'))
  );

create policy "Officers prepare certificates"
  on membership.certificates for insert to authenticated
  with check ((select access.has_permission('certificates.prepare')));

create policy "Officers edit draft certificates"
  on membership.certificates for update to authenticated
  using (status = 'draft' and (select access.has_permission('certificates.prepare')))
  with check (status = 'draft' and (select access.has_permission('certificates.prepare')));

create policy "Officers delete draft certificates"
  on membership.certificates for delete to authenticated
  using (status = 'draft' and (select access.has_permission('certificates.prepare')));

-- Membership is never granted to third-party apps (20261008001500).
create policy "Third-party apps reach only their areas"
  on membership.service_records as restrictive for all to authenticated
  using ((select private.client_allows('membership')))
  with check ((select private.client_allows('membership')));
create policy "Third-party apps reach only their areas"
  on membership.certificates as restrictive for all to authenticated
  using ((select private.client_allows('membership')))
  with check ((select private.client_allows('membership')));

grant select, insert, update, delete on membership.service_records, membership.certificates to authenticated;
grant all on membership.service_records, membership.certificates to service_role;

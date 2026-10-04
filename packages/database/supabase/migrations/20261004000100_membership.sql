-- Membership: tiers, pledges, the verification queue, activity records,
-- voting eligibility and private calendar-feed tokens.

create schema membership;
grant usage on schema membership to anon, authenticated, service_role;

create type membership.tier as enum ('member', 'fellow', 'honorary', 'alumni');
create type membership.pledge_type as enum ('human_authorship', 'member');

create table membership.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier membership.tier not null default 'member',
  member_since date not null default private.today(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on membership.memberships
  for each row execute function private.set_updated_at();

create table membership.pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  pledge_type membership.pledge_type not null,
  version text not null check (version ~ '^[0-9]+(\.[0-9]+)*$'),
  accepted_at timestamptz not null default now(),
  unique (user_id, pledge_type, version)
);

create index pledges_user_id_idx on membership.pledges (user_id);

create table membership.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  -- Who the applicant says they are (alumnus, guest, external contributor).
  statement text check (char_length(statement) <= 1000),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create unique index verification_requests_one_pending_idx
  on membership.verification_requests (user_id) where status = 'pending';
create index verification_requests_status_idx
  on membership.verification_requests (status, created_at);

create table membership.activity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'shift', 'manual')),
  occurred_at timestamptz not null default now(),
  -- Check-ins point at their event; manual records must explain themselves.
  event_id uuid,
  note text check (char_length(note) <= 500),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'manual' or char_length(btrim(coalesce(note, ''))) > 0)
);

create index activity_records_user_id_occurred_at_idx
  on membership.activity_records (user_id, occurred_at);
create unique index activity_records_one_check_in_per_event_idx
  on membership.activity_records (user_id, event_id) where kind = 'check_in';

create table membership.calendar_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- ── Helpers ─────────────────────────────────────────────────────────────────

create function membership.current_pledge_version(kind membership.pledge_type)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.setting('pledges.' || kind::text || '.version') #>> '{}';
$$;

-- A member of the Society: verified and holding a membership row.
create function membership.is_member(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.profiles p
    join membership.memberships m on m.user_id = p.id
    where p.id = uid and p.verified_at is not null
  );
$$;

-- Activities in the current and previous semester (Constitution: a Voting
-- Member has at least 2).
create function private.activity_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from membership.activity_records r
  where r.user_id = uid
    and (r.occurred_at at time zone 'Asia/Baghdad')::date >= coalesce(
      (select p.starts_on from core.previous_semester() p),
      (select c.starts_on from core.current_semester() c)
    )
    and (r.occurred_at at time zone 'Asia/Baghdad')::date
      <= (select c.ends_on from core.current_semester() c);
$$;

create function private.is_voting_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select membership.is_member(uid) and private.activity_count(uid) >= 2;
$$;

-- Public wrappers: a user may ask about themselves; member managers and the
-- elections committee about anyone. Others get null.
create function private.may_read_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uid = auth.uid()
    or access.has_permission('members.manage')
    or access.has_permission('elections.manage');
$$;

create function membership.activity_count(uid uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.may_read_member(uid) then private.activity_count(uid) end;
$$;

create function membership.is_voting_member(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.may_read_member(uid) then private.is_voting_member(uid) end;
$$;

-- Status summary for the member home screen.
create function membership.my_status()
returns table (
  is_member boolean,
  verified boolean,
  tier membership.tier,
  member_since date,
  activities integer,
  voting_member boolean,
  pending_pledges membership.pledge_type[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.is_member(),
    exists (select 1 from core.profiles p where p.id = auth.uid() and p.verified_at is not null),
    (select m.tier from membership.memberships m where m.user_id = auth.uid()),
    (select m.member_since from membership.memberships m where m.user_id = auth.uid()),
    private.activity_count(auth.uid()),
    private.is_voting_member(auth.uid()),
    array(
      select t from unnest(enum_range(null::membership.pledge_type)) t
      where not exists (
        select 1 from membership.pledges pl
        where pl.user_id = auth.uid()
          and pl.pledge_type = t
          and pl.version = membership.current_pledge_version(t)
      )
    );
$$;

create function membership.has_current_pledges(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(enum_range(null::membership.pledge_type)) t
    where not exists (
      select 1 from membership.pledges pl
      where pl.user_id = uid
        and pl.pledge_type = t
        and pl.version = membership.current_pledge_version(t)
    )
  );
$$;

-- ── Sign-up: profile, membership and verification ───────────────────────────

create function private.verify_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update core.profiles set verified_at = coalesce(verified_at, now()) where id = uid;
  insert into membership.memberships (user_id) values (uid)
  on conflict (user_id) do nothing;
end;
$$;

-- New auth user → profile. Confirmed AUIB addresses are verified at once;
-- every other domain lands in the verification queue.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into core.profiles (id, full_name_en, full_name_ar, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name_en', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name_ar', ''), 120), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;

  if private.is_auib_email(new.email) then
    if new.email_confirmed_at is not null then
      perform private.verify_user(new.id);
    end if;
  elsif new.email is not null then
    insert into membership.verification_requests (user_id, email, statement)
    values (
      new.id,
      lower(new.email),
      left(new.raw_user_meta_data ->> 'verification_statement', 1000)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Email confirmed (or changed) later → re-evaluate the AUIB rule.
create function private.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and private.is_auib_email(new.email) then
    perform private.verify_user(new.id);
    update membership.verification_requests
    set status = 'approved', decided_at = now(), decision_note = 'AUIB address confirmed'
    where user_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row execute function private.handle_user_email_confirmed();

-- ── RPCs ────────────────────────────────────────────────────────────────────

create function membership.decide_verification(
  request_id uuid,
  approve boolean,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request membership.verification_requests;
begin
  if not access.has_permission('members.verify') then
    raise exception 'members.verify is required' using errcode = '42501';
  end if;

  select * into request from membership.verification_requests
  where id = request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'No pending verification request %', request_id
      using errcode = 'P0002';
  end if;

  update membership.verification_requests
  set status = case when approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = note
  where id = request_id;

  if approve then
    perform private.verify_user(request.user_id);
  end if;

  perform private.enqueue(
    'membership.verification_decided',
    jsonb_build_object('user_id', request.user_id, 'approved', approve)
  );
end;
$$;

create function membership.set_tier(target_user uuid, new_tier membership.tier)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not access.has_permission('members.manage') then
    raise exception 'members.manage is required' using errcode = '42501';
  end if;

  update membership.memberships set tier = new_tier where user_id = target_user;
  if not found then
    raise exception 'User % is not a member', target_user using errcode = 'P0002';
  end if;
end;
$$;

create function membership.add_manual_activity(
  target_user uuid,
  note text,
  occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not access.has_permission('members.manage') then
    raise exception 'members.manage is required' using errcode = '42501';
  end if;

  insert into membership.activity_records (user_id, kind, occurred_at, note, recorded_by)
  values (target_user, 'manual', add_manual_activity.occurred_at, add_manual_activity.note, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

create function membership.accept_pledge(kind membership.pledge_type, version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if version is distinct from membership.current_pledge_version(kind) then
    raise exception 'Pledge % version % is not current', kind, version
      using errcode = '22023';
  end if;

  insert into membership.pledges (user_id, pledge_type, version)
  values (auth.uid(), kind, accept_pledge.version)
  on conflict (user_id, pledge_type, version) do nothing;
end;
$$;

-- Returns the caller's calendar token, creating it on first use.
create function membership.calendar_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  insert into membership.calendar_tokens (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select token into result from membership.calendar_tokens where user_id = auth.uid();
  return result;
end;
$$;

create function membership.reset_calendar_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  insert into membership.calendar_tokens (user_id) values (auth.uid())
  on conflict (user_id) do update
    set token = encode(extensions.gen_random_bytes(24), 'hex'), created_at = now()
  returning token into result;
  return result;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table membership.memberships enable row level security;
alter table membership.pledges enable row level security;
alter table membership.verification_requests enable row level security;
alter table membership.activity_records enable row level security;
alter table membership.calendar_tokens enable row level security;

create policy "Users read their own membership"
  on membership.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members read the membership roll"
  on membership.memberships for select to authenticated
  using ((select membership.is_member()));
create policy "Member managers read memberships"
  on membership.memberships for select to authenticated
  using ((select access.has_permission('members.manage')));

create policy "Users read their own pledges"
  on membership.pledges for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Member managers read pledges"
  on membership.pledges for select to authenticated
  using ((select access.has_permission('members.manage')));

create policy "Users read their own verification requests"
  on membership.verification_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Verifiers read the verification queue"
  on membership.verification_requests for select to authenticated
  using ((select access.has_permission('members.verify')));
create policy "Users update the statement on their pending request"
  on membership.verification_requests for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Users read their own activity records"
  on membership.activity_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Member managers read activity records"
  on membership.activity_records for select to authenticated
  using ((select access.has_permission('members.manage')));

create policy "Users read their own calendar token"
  on membership.calendar_tokens for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on all tables in schema membership from anon, authenticated;
revoke all on all functions in schema membership from public, anon, authenticated;

grant select on all tables in schema membership to authenticated;
grant update (statement) on membership.verification_requests to authenticated;
grant all on all tables in schema membership to service_role;

grant execute on function
  membership.is_member(uuid),
  membership.current_pledge_version(membership.pledge_type),
  membership.has_current_pledges(uuid)
  to anon, authenticated, service_role;
grant execute on function
  membership.is_voting_member(uuid),
  membership.activity_count(uuid),
  membership.my_status(),
  membership.decide_verification(uuid, boolean, text),
  membership.set_tier(uuid, membership.tier),
  membership.add_manual_activity(uuid, text, timestamptz),
  membership.accept_pledge(membership.pledge_type, text),
  membership.calendar_token(),
  membership.reset_calendar_token()
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert or update or delete on membership.memberships
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on membership.verification_requests
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on membership.activity_records
  for each row execute function private.log_activity();

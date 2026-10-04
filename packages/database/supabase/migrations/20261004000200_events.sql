-- Events: SAL events, RSVPs with capacity and an automatic waitlist, QR
-- tickets, check-ins (which create activity records), event staff and the
-- cached AUIB campus calendar.
--
-- Members-only events are never visible to anonymous users or unverified
-- accounts: the policies below filter them, whatever the query asks for.

create schema events;
grant usage on schema events to anon, authenticated, service_role;

create table events.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  programme_id uuid references core.programmes (id) on delete set null,
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text not null check (char_length(title_ar) between 1 and 200),
  summary_en text check (char_length(summary_en) <= 500),
  summary_ar text check (char_length(summary_ar) <= 500),
  body_en text,
  body_ar text,
  venue_en text,
  venue_ar text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  members_only boolean not null default false,
  capacity integer check (capacity > 0),
  -- Registration questions: [{ "id", "label_en", "label_ar", "required" }].
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  rsvp_enabled boolean not null default true,
  image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index events_starts_at_idx on events.events (starts_at);
create index events_programme_id_idx on events.events (programme_id);
create index events_public_idx on events.events (status, members_only, starts_at);

create trigger set_updated_at before update on events.events
  for each row execute function private.set_updated_at();

create table events.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  -- Encoded in the ticket QR. Random, so tickets can't be guessed.
  ticket_code text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  from_waitlist boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create unique index rsvps_one_active_idx on events.rsvps (event_id, user_id)
  where status = 'confirmed';
create index rsvps_user_id_idx on events.rsvps (user_id);
create index rsvps_event_id_status_idx on events.rsvps (event_id, status);

create table events.waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index waitlist_one_waiting_idx on events.waitlist (event_id, user_id)
  where status = 'waiting';
create index waitlist_event_queue_idx on events.waitlist (event_id, created_at)
  where status = 'waiting';
create index waitlist_user_id_idx on events.waitlist (user_id);

create trigger set_updated_at before update on events.waitlist
  for each row execute function private.set_updated_at();

create table events.event_staff (
  event_id uuid not null references events.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  duty text,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  primary key (event_id, user_id)
);

create index event_staff_user_id_idx on events.event_staff (user_id);

create table events.check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rsvp_id uuid references events.rsvps (id) on delete set null,
  method text not null check (method in ('qr', 'manual')),
  checked_in_by uuid references auth.users (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index check_ins_user_id_idx on events.check_ins (user_id);

alter table membership.activity_records
  add constraint activity_records_event_id_fkey
  foreign key (event_id) references events.events (id) on delete set null;
create index activity_records_event_id_idx on membership.activity_records (event_id);

create table events.campus_events (
  id uuid primary key default gen_random_uuid(),
  uid text not null unique,
  title text not null,
  description text,
  location text,
  url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  fetched_at timestamptz not null default now()
);

create index campus_events_starts_at_idx on events.campus_events (starts_at);

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Visible to the caller: published public events for everyone, published
-- members-only events for members, everything for the programme's managers.
create function private.can_see_event(
  status text,
  members_only boolean,
  programme_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (status in ('published', 'cancelled') and (not members_only or membership.is_member()))
    or access.has_permission('events.manage', 'programme', programme_id);
$$;

create function private.can_check_in(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from events.events e
      where e.id = event_id
        and access.has_permission('events.checkin', 'programme', e.programme_id)
    )
    or exists (
      select 1 from events.event_staff s
      where s.event_id = can_check_in.event_id and s.user_id = auth.uid()
    );
$$;

create function events.confirmed_count(event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from events.rsvps r
  join events.events e on e.id = r.event_id
  where r.event_id = confirmed_count.event_id
    and r.status = 'confirmed'
    and private.can_see_event(e.status, e.members_only, e.programme_id);
$$;

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- RSVP: a confirmed place while there is room, otherwise the waitlist.
-- Returns 'confirmed', 'waitlisted' or 'already'.
create function events.rsvp(event_id uuid, answers jsonb default '{}')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e events.events;
begin
  if not membership.is_member() then
    raise exception 'Only verified members can RSVP' using errcode = '42501';
  end if;

  -- Lock the event so concurrent RSVPs can't overfill it.
  select * into e from events.events where id = rsvp.event_id for update;

  if not found or e.status <> 'published' or not private.can_see_event(e.status, e.members_only, e.programme_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if not e.rsvp_enabled then
    raise exception 'This event does not take RSVPs' using errcode = '22023';
  end if;
  if coalesce(e.ends_at, e.starts_at) < now() then
    raise exception 'This event has ended' using errcode = '22023';
  end if;

  if exists (
    select 1 from events.rsvps r
    where r.event_id = e.id and r.user_id = auth.uid() and r.status = 'confirmed'
  ) or exists (
    select 1 from events.waitlist w
    where w.event_id = e.id and w.user_id = auth.uid() and w.status = 'waiting'
  ) then
    return 'already';
  end if;

  if e.capacity is null or events.confirmed_count(e.id) < e.capacity then
    insert into events.rsvps (event_id, user_id, answers)
    values (e.id, auth.uid(), coalesce(rsvp.answers, '{}'));
    perform private.enqueue('events.rsvp_confirmed',
      jsonb_build_object('event_id', e.id, 'user_id', auth.uid()));
    return 'confirmed';
  end if;

  insert into events.waitlist (event_id, user_id, answers)
  values (e.id, auth.uid(), coalesce(rsvp.answers, '{}'));
  return 'waitlisted';
end;
$$;

-- Promote waitlisted members into free places, oldest first.
create function private.promote_waitlist(event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e events.events;
  next_in_line events.waitlist;
  promoted integer := 0;
begin
  select * into e from events.events where id = promote_waitlist.event_id for update;

  loop
    exit when e.capacity is not null and events.confirmed_count(e.id) >= e.capacity;

    select * into next_in_line from events.waitlist w
    where w.event_id = e.id and w.status = 'waiting'
    order by w.created_at
    limit 1
    for update skip locked;

    exit when not found;

    update events.waitlist set status = 'promoted' where id = next_in_line.id;
    insert into events.rsvps (event_id, user_id, answers, from_waitlist)
    values (e.id, next_in_line.user_id, next_in_line.answers, true);
    perform private.enqueue('events.waitlist_promoted',
      jsonb_build_object('event_id', e.id, 'user_id', next_in_line.user_id));
    promoted := promoted + 1;
  end loop;

  return promoted;
end;
$$;

-- Cancel the caller's RSVP (or leave the waitlist) and promote the next
-- person in line.
create function events.cancel_rsvp(event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update events.waitlist w set status = 'left'
  where w.event_id = cancel_rsvp.event_id and w.user_id = auth.uid() and w.status = 'waiting';

  update events.rsvps r set status = 'cancelled', cancelled_at = now()
  where r.event_id = cancel_rsvp.event_id and r.user_id = auth.uid() and r.status = 'confirmed';

  if found then
    perform private.promote_waitlist(cancel_rsvp.event_id);
  end if;
end;
$$;

-- Event managers may raise capacity; this fills the new places.
create function private.after_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capacity is distinct from old.capacity then
    perform private.promote_waitlist(new.id);
  end if;
  return new;
end;
$$;

create trigger promote_after_capacity_change after update of capacity on events.events
  for each row execute function private.after_capacity_change();

-- Waitlist position (1-based) for the caller, or null.
create function events.waitlist_position(event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select pos::integer from (
    select w.user_id, row_number() over (order by w.created_at) as pos
    from events.waitlist w
    where w.event_id = waitlist_position.event_id and w.status = 'waiting'
  ) q
  where q.user_id = auth.uid();
$$;

-- Check a member in by ticket code (QR) or by user id (manual lookup).
-- Records the check-in and the activity record that counts towards voting.
create function events.check_in(
  event_id uuid,
  ticket_code text default null,
  target_user uuid default null
)
returns table (user_id uuid, full_name_en text, full_name_ar text, already boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendee uuid;
  ticket events.rsvps;
  e events.events;
  inserted boolean;
begin
  if not private.can_check_in(check_in.event_id) then
    raise exception 'events.checkin is required for this event' using errcode = '42501';
  end if;

  select * into e from events.events where id = check_in.event_id;

  if check_in.ticket_code is not null then
    select * into ticket from events.rsvps r
    where r.ticket_code = check_in.ticket_code
      and r.event_id = check_in.event_id
      and r.status = 'confirmed';
    if not found then
      raise exception 'Ticket not valid for this event' using errcode = 'P0002';
    end if;
    attendee := ticket.user_id;
  elsif target_user is not null then
    attendee := target_user;
    select * into ticket from events.rsvps r
    where r.event_id = check_in.event_id and r.user_id = attendee and r.status = 'confirmed';
  else
    raise exception 'Give a ticket code or a member' using errcode = '22023';
  end if;

  insert into events.check_ins (event_id, user_id, rsvp_id, method, checked_in_by)
  values (
    check_in.event_id, attendee, ticket.id,
    case when check_in.ticket_code is null then 'manual' else 'qr' end,
    auth.uid()
  )
  on conflict on constraint check_ins_event_id_user_id_key do nothing;
  inserted := found;

  if inserted then
    insert into membership.activity_records (user_id, kind, occurred_at, event_id, recorded_by)
    values (attendee, 'check_in', least(now(), e.starts_at + interval '1 day'), check_in.event_id, auth.uid())
    on conflict do nothing;
  end if;

  return query
    select p.id, p.full_name_en, p.full_name_ar, not inserted
    from core.profiles p where p.id = attendee;
end;
$$;

-- Manual lookup for the check-in screen: members by name or email.
create function events.find_attendee(event_id uuid, query text)
returns table (user_id uuid, full_name_en text, full_name_ar text, email text, has_rsvp boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_check_in(find_attendee.event_id) then
    raise exception 'events.checkin is required for this event' using errcode = '42501';
  end if;
  if char_length(btrim(query)) < 2 then
    return;
  end if;

  return query
    select p.id, p.full_name_en, p.full_name_ar, u.email::text,
      exists (
        select 1 from events.rsvps r
        where r.event_id = find_attendee.event_id and r.user_id = p.id and r.status = 'confirmed'
      )
    from core.profiles p
    join auth.users u on u.id = p.id
    where p.verified_at is not null
      and (
        p.full_name_en ilike '%' || btrim(query) || '%'
        or p.full_name_ar ilike '%' || btrim(query) || '%'
        or u.email ilike btrim(query) || '%'
      )
    order by p.full_name_en
    limit 20;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table events.events enable row level security;
alter table events.rsvps enable row level security;
alter table events.waitlist enable row level security;
alter table events.event_staff enable row level security;
alter table events.check_ins enable row level security;
alter table events.campus_events enable row level security;

create policy "Anyone reads published public events"
  on events.events for select to anon
  using (status in ('published', 'cancelled') and not members_only);
create policy "Signed-in users read the events they may see"
  on events.events for select to authenticated
  using ((select private.can_see_event(status, members_only, programme_id)));
create policy "Event managers create events in their programme"
  on events.events for insert to authenticated
  with check ((select access.has_permission('events.manage', 'programme', programme_id)));
create policy "Event managers edit events in their programme"
  on events.events for update to authenticated
  using ((select access.has_permission('events.manage', 'programme', programme_id)))
  with check ((select access.has_permission('events.manage', 'programme', programme_id)));
create policy "Event managers delete draft events"
  on events.events for delete to authenticated
  using (
    status = 'draft'
    and (select access.has_permission('events.manage', 'programme', programme_id))
  );

create policy "Members read their own RSVPs"
  on events.rsvps for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Event managers and staff read RSVPs"
  on events.rsvps for select to authenticated
  using ((select private.can_check_in(event_id)) or exists (
    select 1 from events.events e
    where e.id = event_id
      and (select access.has_permission('events.manage', 'programme', e.programme_id))
  ));

create policy "Members read their own waitlist places"
  on events.waitlist for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Event managers read the waitlist"
  on events.waitlist for select to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id
      and (select access.has_permission('events.manage', 'programme', e.programme_id))
  ));

create policy "Staff read their own duties"
  on events.event_staff for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Event managers manage event staff"
  on events.event_staff for all to authenticated
  using (exists (
    select 1 from events.events e
    where e.id = event_id
      and (select access.has_permission('events.manage', 'programme', e.programme_id))
  ))
  with check (exists (
    select 1 from events.events e
    where e.id = event_id
      and (select access.has_permission('events.manage', 'programme', e.programme_id))
  ));

create policy "Members read their own check-ins"
  on events.check_ins for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Check-in staff read check-ins"
  on events.check_ins for select to authenticated
  using ((select private.can_check_in(event_id)));

create policy "Anyone reads the AUIB campus calendar"
  on events.campus_events for select to anon, authenticated using (true);

revoke all on all tables in schema events from anon, authenticated;
revoke all on all functions in schema events from public, anon, authenticated;

grant select on events.events, events.campus_events to anon, authenticated;
grant select on events.rsvps, events.waitlist, events.event_staff, events.check_ins
  to authenticated;
grant insert (slug, programme_id, title_en, title_ar, summary_en, summary_ar,
  body_en, body_ar, venue_en, venue_ar, starts_at, ends_at, members_only,
  capacity, questions, rsvp_enabled, image_path, status, published_at)
  on events.events to authenticated;
grant update (slug, programme_id, title_en, title_ar, summary_en, summary_ar,
  body_en, body_ar, venue_en, venue_ar, starts_at, ends_at, members_only,
  capacity, questions, rsvp_enabled, image_path, status, published_at)
  on events.events to authenticated;
grant delete on events.events to authenticated;
grant insert, update, delete on events.event_staff to authenticated;
grant all on all tables in schema events to service_role;

grant execute on function events.confirmed_count(uuid) to anon, authenticated, service_role;
grant execute on function
  events.rsvp(uuid, jsonb),
  events.cancel_rsvp(uuid),
  events.waitlist_position(uuid),
  events.check_in(uuid, text, uuid),
  events.find_attendee(uuid, text)
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert or update or delete on events.events
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on events.check_ins
  for each row execute function private.log_activity();

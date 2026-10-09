-- Who may hold which roles together, checked when a role is assigned
-- (access.assign_role, the only way roles are given):
--
--   * No person holds more than one Council seat (Constitution 6.6), so
--     the Treasurer and the President are never the same person (B9.8).
--   * The Faculty Advisor is a member of the University's faculty or staff
--     (Constitution 9.1) and holds no other Society role.
--   * No person holds the same role, in the same scope, twice at once.
--   * No person holds more than two Society roles at once, nor more than
--     one leadership role (officer, director or program chair), except in
--     the founding term with the Council's agreement (B5.5): an exception
--     names the adopted Council resolution that agreed to it.
--
-- The rules look at the period of the new assignment against every
-- assignment that overlaps it. Assignments made before this migration are
-- left as they are; ending one is always allowed.
--
-- The public Council roster now lists each person once per office.

alter table access.role_assignments
  add column exception_resolution_id uuid references governance.resolutions (id) on delete restrict;

create index role_assignments_exception_resolution_id_idx
  on access.role_assignments (exception_resolution_id);

comment on column access.role_assignments.exception_resolution_id is
  'The adopted Council resolution agreeing to a founding-term exception to B5.5 (two roles, one leadership role).';

-- Officer, director or program chair (B5.5).
create function private.is_leadership_role(role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from access.roles r where r.key = role_key and r.is_council)
    or role_key in ('programme_lead', 'production_lead');
$$;

revoke all on function private.is_leadership_role(text) from public, anon, authenticated;

-- The rule a new assignment would break, or null when it breaks none.
create function private.role_conflict(
  target_user uuid,
  role_key text,
  scope_type text,
  scope_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  exception_resolution uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  council boolean;
  roles text[];
  same boolean;
  leaders integer;
begin
  select r.is_council into council from access.roles r where r.key = role_key;

  -- Roles held in a period that overlaps the new assignment's.
  select coalesce(array_agg(distinct a.role), '{}'),
    coalesce(bool_or(a.role = role_key and a.scope_type = role_conflict.scope_type
      and a.scope_id is not distinct from role_conflict.scope_id), false)
  into roles, same
  from access.role_assignments a
  where a.user_id = target_user
    and a.starts_at < coalesce(role_conflict.ends_at, 'infinity'::timestamptz)
    and coalesce(a.ends_at, 'infinity'::timestamptz) > role_conflict.starts_at;

  if same then
    return 'already_holds_role';
  end if;
  if (role_key = 'faculty_advisor' and cardinality(roles) > 0) or 'faculty_advisor' = any (roles) then
    return 'advisor_holds_no_other_role';
  end if;
  if council and exists (
    select 1 from access.roles r where r.key = any (roles) and r.is_council
  ) then
    return 'one_council_seat';
  end if;

  select count(*) into leaders from unnest(roles) held where private.is_leadership_role(held);
  -- The new role may already be held in another scope; count it once.
  if not (role_key = any (roles))
    and (cardinality(roles) >= 2 or (private.is_leadership_role(role_key) and leaders >= 1)) then
    if exception_resolution is null then
      return case when cardinality(roles) >= 2 then 'two_roles_at_most' else 'one_leadership_role' end;
    end if;
    if not exists (
      select 1 from governance.resolutions res
      where res.id = exception_resolution and res.status = 'adopted' and res.body = 'council'
    ) then
      return 'exception_needs_adopted_resolution';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.role_conflict(uuid, text, text, uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

drop function access.assign_role(uuid, text, text, uuid, timestamptz, timestamptz, text, text, text);

create function access.assign_role(
  target_user uuid,
  role_key text,
  scope_type text default 'global',
  scope_id uuid default null,
  starts_at timestamptz default now(),
  ends_at timestamptz default null,
  title_en text default null,
  title_ar text default null,
  note text default null,
  exception_resolution uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  conflict text;
begin
  if not access.has_permission('roles.assign') then
    raise exception 'roles.assign is required' using errcode = '42501';
  end if;

  conflict := private.role_conflict(
    target_user, role_key, coalesce(assign_role.scope_type, 'global'), assign_role.scope_id,
    coalesce(assign_role.starts_at, now()), assign_role.ends_at, exception_resolution
  );
  if conflict is not null then
    raise exception '%', conflict using errcode = '23P01';
  end if;

  insert into access.role_assignments
    (user_id, role, scope_type, scope_id, starts_at, ends_at,
     title_en, title_ar, assigned_by, note, exception_resolution_id)
  values
    (target_user, role_key, assign_role.scope_type, assign_role.scope_id,
     coalesce(assign_role.starts_at, now()), assign_role.ends_at,
     assign_role.title_en, assign_role.title_ar, (select auth.uid()),
     assign_role.note, exception_resolution)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function access.assign_role(uuid, text, text, uuid, timestamptz, timestamptz, text, text, text, uuid)
  from public, anon;
grant execute on function access.assign_role(uuid, text, text, uuid, timestamptz, timestamptz, text, text, text, uuid)
  to authenticated;

-- One row per office and person, even when an office was assigned twice.
create or replace function governance.council_roster()
returns table (
  role text,
  role_name_en text,
  role_name_ar text,
  title_en text,
  title_ar text,
  full_name_en text,
  full_name_ar text,
  sort integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select role, role_name_en, role_name_ar, title_en, title_ar, full_name_en, full_name_ar, sort
  from (
    select distinct on (a.role, a.user_id)
      a.role, r.name_en as role_name_en, r.name_ar as role_name_ar, a.title_en, a.title_ar,
      p.full_name_en, p.full_name_ar, r.sort
    from access.role_assignments a
    join access.roles r on r.key = a.role
    join core.profiles p on p.id = a.user_id
    where r.is_council
      and a.scope_type = 'global'
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
    -- Prefer the assignment with a display title, then the oldest.
    order by a.role, a.user_id, (a.title_en is null), a.starts_at
  ) roster
  order by sort, full_name_en;
$$;

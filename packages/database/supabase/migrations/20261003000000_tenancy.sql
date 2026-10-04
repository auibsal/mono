-- Multi-tenant foundation: profiles, organizations, memberships, invitations
-- and an example tenant-scoped resource (projects) to copy for new tables.
--
-- Authorization rule of thumb: rows belong to an organization; a user can
-- touch a row only through a membership in that organization. Helper
-- functions live in the non-exposed `private` schema and are SECURITY
-- DEFINER so policies on `memberships` don't recurse into themselves.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.org_role as enum ('owner', 'admin', 'member');

-- ── Helpers ─────────────────────────────────────────────────────────────────

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text check (char_length(avatar_url) <= 2048),
  locale text not null default 'ar' check (locale in ('ar', 'en', 'ckb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile data. Contact details (phone, email) stay in auth.users.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- E.164 phone number (+9647…) or lowercase email address.
  invitee text not null check (
    invitee ~ '^\+[1-9][0-9]{7,14}$' or invitee ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.org_role not null default 'member' check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_organization_id_idx on public.invitations (organization_id);

-- Example tenant-scoped table. Copy this shape (organization_id + policies)
-- for every new resource.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_organization_id_idx on public.projects (organization_id);

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();

-- ── Membership helpers (used by RLS policies) ───────────────────────────────

create function private.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create function private.shares_org_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs using (organization_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- ── Triggers ────────────────────────────────────────────────────────────────

-- Every new auth user gets a profile. Metadata is user-supplied, so it is only
-- used for display fields and validated by the table's check constraints.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, full_name, avatar_url, locale)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    left(new.raw_user_meta_data ->> 'avatar_url', 2048),
    case when requested_locale in ('ar', 'en', 'ckb') then requested_locale else 'ar' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- An organization must always keep at least one owner. Cascading deletes
-- (organization removed) are allowed.
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner')
    and exists (select 1 from public.organizations o where o.id = old.organization_id)
    and not exists (
      select 1 from public.memberships m
      where m.organization_id = old.organization_id
        and m.role = 'owner'
        and m.user_id <> old.user_id
    )
  then
    raise exception 'An organization must keep at least one owner'
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_last_owner
  before update or delete on public.memberships
  for each row execute function private.protect_last_owner();

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Creates an organization with the caller as its owner (atomically).
create function public.create_organization(org_name text, org_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  created public.organizations;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (org_name, org_slug, caller)
  returning * into created;

  insert into public.memberships (organization_id, user_id, role)
  values (created.id, caller, 'owner');

  return created;
end;
$$;

-- Accepts an invitation addressed to the caller's phone number or email.
create function public.accept_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  -- Supabase stores phone numbers without the leading "+".
  caller_phone text := nullif(auth.jwt() ->> 'phone', '');
  caller_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  invitation public.invitations;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into invitation
  from public.invitations
  where token = invitation_token and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation not found or expired' using errcode = 'no_data_found';
  end if;

  if invitation.invitee is distinct from caller_email
    and invitation.invitee is distinct from '+' || ltrim(caller_phone, '+')
  then
    raise exception 'This invitation is for a different account'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (invitation.organization_id, caller, invitation.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = invitation.id;

  return invitation.organization_id;
end;
$$;

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;

create policy "Profiles are visible to the user and their teammates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members see their organizations"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "Owners and admins update the organization"
  on public.organizations for update to authenticated
  using (private.has_org_role(id, '{owner,admin}'))
  with check (private.has_org_role(id, '{owner,admin}'));

create policy "Owners delete the organization"
  on public.organizations for delete to authenticated
  using (private.has_org_role(id, '{owner}'));

create policy "Members see their organization's memberships"
  on public.memberships for select to authenticated
  using (private.is_org_member(organization_id));

-- Nobody inserts memberships directly: users join through
-- create_organization() or accept_invitation(). Only owners manage owners.
create policy "Owners and admins change roles"
  on public.memberships for update to authenticated
  using (
    private.has_org_role(organization_id, '{owner}')
    or (private.has_org_role(organization_id, '{admin}') and role <> 'owner')
  )
  with check (
    private.has_org_role(organization_id, '{owner}')
    or (private.has_org_role(organization_id, '{admin}') and role <> 'owner')
  );

create policy "Owners and admins remove members; anyone can leave"
  on public.memberships for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, '{owner}')
    or (private.has_org_role(organization_id, '{admin}') and role <> 'owner')
  );

create policy "Owners and admins see invitations"
  on public.invitations for select to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'));

create policy "Owners and admins create invitations"
  on public.invitations for insert to authenticated
  with check (
    private.has_org_role(organization_id, '{owner,admin}')
    and invited_by = (select auth.uid())
  );

create policy "Owners and admins revoke invitations"
  on public.invitations for delete to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'));

create policy "Members see projects"
  on public.projects for select to authenticated
  using (private.is_org_member(organization_id));

create policy "Members create projects"
  on public.projects for insert to authenticated
  with check (
    private.is_org_member(organization_id)
    and created_by = (select auth.uid())
  );

create policy "Members update projects"
  on public.projects for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy "Creators, owners and admins delete projects"
  on public.projects for delete to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_org_role(organization_id, '{owner,admin}')
  );

-- ── Privileges ──────────────────────────────────────────────────────────────
-- Explicit grants instead of relying on default privileges. Column lists make
-- identifiers immutable (e.g. a project can't be moved to another org).

revoke all on public.profiles, public.organizations, public.memberships,
  public.invitations, public.projects from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, locale) on public.profiles to authenticated;

grant select, delete on public.organizations to authenticated;
grant update (name, slug) on public.organizations to authenticated;

grant select, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;

grant select, delete on public.invitations to authenticated;
grant insert (organization_id, invitee, role, invited_by) on public.invitations
  to authenticated;

grant select, delete on public.projects to authenticated;
grant insert (organization_id, name, created_by) on public.projects to authenticated;
grant update (name) on public.projects to authenticated;

grant all on public.profiles, public.organizations, public.memberships,
  public.invitations, public.projects to service_role;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

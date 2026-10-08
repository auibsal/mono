-- Two-step sign-in (TOTP, Supabase Auth MFA) for the roles that move money,
-- run the Society or run elections (owner, 2026-10-08): the Council's
-- officers and directors and the Elections Committee. Their permissions
-- count only on a session verified with a second factor (JWT aal = aal2).
-- Every other role works at aal1 as before.

alter table access.roles add column requires_mfa boolean not null default false;
update access.roles set requires_mfa = true
where is_council or key = 'elections_committee';

-- True when this request's session passed a second factor.
create function private.session_two_step()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create or replace function access.has_permission(
  permission text,
  scope_type text default 'global',
  scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    join access.roles r on r.key = a.role
    where a.user_id = (select auth.uid())
      and rp.permission = has_permission.permission
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and (not r.requires_mfa or (select private.session_two_step()))
      and (
        a.scope_type = 'global'
        or (
          a.scope_type = has_permission.scope_type
          and a.scope_id = has_permission.scope_id
        )
      )
  );
$$;

create or replace function access.has_permission_anywhere(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    join access.roles r on r.key = a.role
    where a.user_id = (select auth.uid())
      and rp.permission = has_permission_anywhere.permission
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and (not r.requires_mfa or (select private.session_two_step()))
  );
$$;

create or replace function access.my_permissions()
returns table (permission text, scope_type text, scope_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct rp.permission, a.scope_type, a.scope_id
  from access.role_assignments a
  join access.role_permissions rp on rp.role = a.role
  join access.roles r on r.key = a.role
  where a.user_id = (select auth.uid())
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now())
    and (not r.requires_mfa or (select private.session_two_step()));
$$;

-- For the Nexus: does the caller hold a role that needs two-step sign-in?
create function access.needs_two_step()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from access.role_assignments a
    join access.roles r on r.key = a.role
    where a.user_id = (select auth.uid())
      and r.requires_mfa
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  );
$$;

revoke all on function access.needs_two_step() from public, anon;
grant execute on function access.needs_two_step() to authenticated, service_role;
grant execute on function private.session_two_step() to authenticated, service_role;

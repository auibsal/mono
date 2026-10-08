-- membership.is_member(uid) and membership.has_current_pledges(uid) were
-- executable by anon and answered about any user id. They now follow the
-- wrapper rule of membership.is_voting_member: a caller may ask about
-- themselves; member managers, the elections committee and the service role
-- (apps/api's calendar feed) about anyone. Everyone else gets false. RLS policies call them with no argument (the
-- caller), so their behavior is unchanged. Internal code uses the
-- unrestricted private.* versions.

create function private.is_member(uid uuid)
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

create function private.has_current_pledges(uid uuid)
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

revoke all on function private.is_member(uuid), private.has_current_pledges(uuid)
  from public, anon, authenticated;

create or replace function membership.is_member(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(private.may_read_member(uid), false)
      or coalesce((select auth.role()) = 'service_role', false))
    and private.is_member(uid);
$$;

create or replace function membership.has_current_pledges(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(private.may_read_member(uid), false)
      or coalesce((select auth.role()) = 'service_role', false))
    and private.has_current_pledges(uid);
$$;

create or replace function private.is_voting_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(uid) and private.activity_count(uid) >= 2;
$$;

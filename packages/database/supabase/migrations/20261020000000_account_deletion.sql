-- Account deletion (App Store guideline 5.1.1(v), Google Play account
-- deletion policy).
--
-- Deleting a user (auth.admin.deleteUser, called by apps/api) cascades to
-- their profile and memberships and clears created_by / invited_by /
-- payments.user_id. One thing must be resolved first: an organization whose
-- only owner is the user. private.protect_last_owner already refuses to
-- remove that membership, so the deletion would fail; this function lets
-- the app explain why beforehand and offer the fixes (make another member
-- an owner, or delete the organization).

-- Organizations the caller alone owns, with how many other members each has
-- (0 means the organization can only be deleted, not handed over).
create function public.account_deletion_blockers()
returns table (organization_id uuid, name text, slug text, other_members bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug,
    (
      select count(*)
      from public.memberships others
      where others.organization_id = o.id
        and others.user_id <> (select auth.uid())
    )
  from public.organizations o
  join public.memberships mine
    on mine.organization_id = o.id
   and mine.user_id = (select auth.uid())
   and mine.role = 'owner'
  where not exists (
    select 1
    from public.memberships co_owner
    where co_owner.organization_id = o.id
      and co_owner.role = 'owner'
      and co_owner.user_id <> (select auth.uid())
  )
  order by o.name;
$$;

revoke all on function public.account_deletion_blockers() from public, anon;
grant execute on function public.account_deletion_blockers() to authenticated;

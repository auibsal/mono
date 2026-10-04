-- Invitations addressed to the signed-in user, for onboarding. Invitees can't
-- read the invitations table itself (owners and admins manage it), so this
-- returns only what they need to decide: the organization, role and token.

create function public.pending_invitations()
returns table (
  token uuid,
  organization_id uuid,
  organization_name text,
  role public.org_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.organization_id, o.name, i.role, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.accepted_at is null
    and i.expires_at > now()
    and (
      i.invitee = lower(nullif(auth.jwt() ->> 'email', ''))
      -- Supabase stores phone numbers without the leading "+".
      or i.invitee = '+' || ltrim(nullif(auth.jwt() ->> 'phone', ''), '+')
    )
    and not exists (
      select 1 from public.memberships m
      where m.organization_id = i.organization_id
        and m.user_id = (select auth.uid())
    )
  order by i.created_at;
$$;

revoke all on function public.pending_invitations() from public, anon;
grant execute on function public.pending_invitations() to authenticated;

-- Nexus admin helpers: the members directory (with sign-in emails, which
-- live in auth.users and are otherwise unreachable from a client) and the
-- Overview figures. Each figure is returned only to holders of the
-- permission that governs it.

-- ── Members directory ───────────────────────────────────────────────────────

create function membership.directory()
returns table (
  user_id uuid,
  email text,
  full_name_en text,
  full_name_ar text,
  tier membership.tier,
  member_since date,
  verified_at timestamptz,
  activities integer,
  voting_member boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    access.has_permission('members.manage')
    or access.has_permission('members.verify')
    or access.has_permission('roles.assign')
  ) then
    raise exception 'members.manage, members.verify or roles.assign is required'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name_en,
    p.full_name_ar,
    m.tier,
    m.member_since,
    p.verified_at,
    private.activity_count(p.id),
    private.is_voting_member(p.id),
    p.created_at
  from core.profiles p
  join auth.users u on u.id = p.id
  left join membership.memberships m on m.user_id = p.id
  order by lower(p.full_name_en), p.created_at;
end;
$$;

revoke all on function membership.directory() from public, anon;
grant execute on function membership.directory() to authenticated, service_role;

-- ── Overview ────────────────────────────────────────────────────────────────
-- One JSON object; a key is present only when the caller holds the
-- permission behind it (in any scope, counting only rows in their scopes).

create function core.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
begin
  if access.has_permission('members.manage') then
    result := result || jsonb_build_object(
      'members', (
        select count(*)
        from membership.memberships m
        join core.profiles p on p.id = m.user_id
        where p.verified_at is not null
      ),
      'voting_members', (
        select count(*)
        from membership.memberships m
        join core.profiles p on p.id = m.user_id
        where p.verified_at is not null and private.is_voting_member(m.user_id)
      ),
      'verification_pending', (
        select count(*) from membership.verification_requests where status = 'pending'
      )
    );
  end if;

  if access.has_permission_anywhere('events.manage') then
    result := result || jsonb_build_object(
      'upcoming_rsvps', (
        select count(*)
        from events.rsvps r
        join events.events e on e.id = r.event_id
        where r.status = 'confirmed'
          and e.starts_at > now()
          and (
            access.has_permission('events.manage')
            or access.has_permission('events.manage', 'programme', e.programme_id)
          )
      )
    );
  end if;

  if access.has_permission_anywhere('journal.manage') then
    result := result || jsonb_build_object(
      'open_submissions', (
        select count(*)
        from journal.submissions s
        where s.status in ('received', 'intake_check', 'in_review', 'third_read', 'selection')
          and (
            access.has_permission('journal.manage')
            or access.has_permission('journal.manage', 'issue', private.call_issue(s.call_id))
          )
      )
    );
  end if;

  if access.has_permission_anywhere('charity.manage') then
    result := result || jsonb_build_object(
      'campaigns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'campaign_id', c.id,
          'title_en', c.title_en,
          'title_ar', c.title_ar,
          'counted_iqd', p.counted_iqd,
          'pending_iqd', p.pending_iqd,
          'units', p.units,
          'target_units', p.target_units
        ) order by c.title_en)
        from charity.campaigns c
        cross join lateral charity.campaign_progress(c.id) p
        where c.status = 'active'
          and (
            access.has_permission('charity.manage')
            or access.has_permission('charity.manage', 'campaign', c.id)
          )
      ), '[]'::jsonb)
    );
  end if;

  return result;
end;
$$;

revoke all on function core.admin_overview() from public, anon;
grant execute on function core.admin_overview() to authenticated, service_role;

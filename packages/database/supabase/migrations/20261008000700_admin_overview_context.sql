-- The admin Overview shows context, not bare counts (owner, 2026-10-08):
-- how long the oldest verification request and the oldest unchecked
-- submission have waited, submissions per stage, and the next event's
-- bookings. Same permission gates as before.
create or replace function core.admin_overview()
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
      ),
      'verification_oldest_at', (
        select min(created_at) from membership.verification_requests where status = 'pending'
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
      ),
      'next_event', (
        select jsonb_build_object(
          'title_en', e.title_en, 'title_ar', e.title_ar, 'starts_at', e.starts_at,
          'capacity', e.capacity, 'booked', events.confirmed_count(e.id)
        )
        from events.events e
        where e.status = 'published' and e.starts_at > now()
          and (
            access.has_permission('events.manage')
            or access.has_permission('events.manage', 'programme', e.programme_id)
          )
        order by e.starts_at
        limit 1
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
      ),
      'submissions_by_status', coalesce((
        select jsonb_object_agg(status, n)
        from (
          select s.status, count(*) as n, min(s.created_at) as oldest
          from journal.submissions s
          where s.status in ('received', 'intake_check', 'in_review', 'third_read', 'selection')
            and (
              access.has_permission('journal.manage')
              or access.has_permission('journal.manage', 'issue', private.call_issue(s.call_id))
            )
          group by s.status
        ) grouped
      ), '{}'::jsonb),
      'intake_oldest_at', (
        select min(s.created_at)
        from journal.submissions s
        where s.status in ('received', 'intake_check')
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


-- Waraq pipeline support for the Nexus board.
--
-- • journal.pipeline_issues(): the issues the caller has a part in, with
--   what they may do there, so the board shows only the caller's columns.
-- • journal.review_team(issue): readers who can be assigned (journal.review
--   for the issue), for the Submissions Manager.
-- • journal.intake_queue(issue): submissions in intake with the author's
--   name, for the Submissions Manager only (journal.identity.view).
--
-- None of these hands identity to readers or editors: blind review stays
-- with journal.blind_entries.

create function journal.pipeline_issues()
returns table (
  id uuid,
  volume integer,
  number integer,
  title_en text,
  title_ar text,
  status text,
  can_manage boolean,
  can_identity boolean,
  can_decide boolean,
  can_review boolean,
  can_advise boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select i.id, i.volume, i.number, i.title_en, i.title_ar, i.status,
      access.has_permission('journal.manage', 'issue', i.id),
      access.has_permission('journal.identity.view', 'issue', i.id),
      access.has_permission('journal.decide', 'issue', i.id),
      access.has_permission('journal.review', 'issue', i.id),
      access.has_permission('journal.advise', 'issue', i.id)
    from journal.issues i
  ) x (id, volume, number, title_en, title_ar, status,
       can_manage, can_identity, can_decide, can_review, can_advise)
  where can_manage or can_identity or can_decide or can_review or can_advise
  order by volume desc, number desc;
$$;

create function journal.review_team(issue_id uuid)
returns table (user_id uuid, full_name_en text, full_name_ar text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.can_view_identity(review_team.issue_id)
          or private.is_issue_editor(review_team.issue_id)) then
    raise exception 'journal.identity.view or journal.manage is required'
      using errcode = '42501';
  end if;

  return query
    select distinct p.id, p.full_name_en, p.full_name_ar
    from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    join core.profiles p on p.id = a.user_id
    where rp.permission = 'journal.review'
      and (a.scope_type = 'global'
        or (a.scope_type = 'issue' and a.scope_id = review_team.issue_id))
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
    order by p.full_name_en;
end;
$$;

create function journal.intake_queue(issue_id uuid)
returns table (
  submission_id uuid,
  blind_entry_id uuid,
  title text,
  category journal.category,
  language journal.language,
  status journal.submission_status,
  author_name_en text,
  author_name_ar text,
  file_count integer,
  intake_note text,
  intake_returned_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_view_identity(intake_queue.issue_id) then
    raise exception 'journal.identity.view is required' using errcode = '42501';
  end if;

  return query
    select s.id, k.blind_entry_id, s.title, s.category, s.language, s.status,
      p.full_name_en, p.full_name_ar,
      (select count(*)::integer from journal.submission_files f where f.submission_id = s.id),
      s.intake_note, s.intake_returned_at, s.created_at, s.updated_at
    from journal.submissions s
    join journal.calls c on c.id = s.call_id
    left join journal.blind_keys k on k.submission_id = s.id
    left join core.profiles p on p.id = s.author_id
    where c.issue_id = intake_queue.issue_id
    order by s.created_at;
end;
$$;

revoke all on function journal.pipeline_issues() from public, anon;
revoke all on function journal.review_team(uuid) from public, anon;
revoke all on function journal.intake_queue(uuid) from public, anon;
grant execute on function journal.pipeline_issues() to authenticated, service_role;
grant execute on function journal.review_team(uuid) to authenticated, service_role;
grant execute on function journal.intake_queue(uuid) to authenticated, service_role;

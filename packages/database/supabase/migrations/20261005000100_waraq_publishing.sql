-- Waraq publishing: an accepted submission becomes a draft piece, and no
-- piece made from a submission is published before its author has signed
-- the Publication Agreement.
--
-- Publishers (journal.publish) never read journal.submissions; this
-- function copies what the piece needs (title, category, language, text and
-- the author's name for the contributor record) once a decision to accept
-- has been recorded, which is when the author's identity may be revealed.

create function journal.piece_from_entry(blind_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  entry journal.blind_entries;
  sub journal.submissions;
  author core.profiles;
  contributor_id uuid;
  piece_id uuid;
  base_slug text;
  candidate_slug text;
  n integer := 1;
begin
  select * into entry from journal.blind_entries b where b.id = piece_from_entry.blind_entry_id;
  if not found or not access.has_permission('journal.publish', 'issue', entry.issue_id) then
    raise exception 'journal.publish is required for this issue' using errcode = '42501';
  end if;
  if not exists (
    select 1 from journal.decisions d
    where d.blind_entry_id = entry.id and d.decision in ('accept', 'accept_with_edits')
  ) then
    raise exception 'Only accepted work becomes a piece' using errcode = '22023';
  end if;

  select s.* into sub from journal.submissions s
  join journal.blind_keys k on k.submission_id = s.id
  where k.blind_entry_id = entry.id;

  select p.id into piece_id from journal.pieces p where p.submission_id = sub.id;
  if found then
    return piece_id;
  end if;

  select * into author from core.profiles where id = sub.author_id;

  select c.id into contributor_id from journal.contributors c where c.user_id = sub.author_id;
  if contributor_id is null then
    base_slug := coalesce(
      nullif(trim(both '-' from regexp_replace(lower(author.full_name_en), '[^a-z0-9]+', '-', 'g')), ''),
      'contributor'
    );
    candidate_slug := base_slug;
    while exists (select 1 from journal.contributors c where c.slug = candidate_slug) loop
      n := n + 1;
      candidate_slug := base_slug || '-' || n;
    end loop;
    insert into journal.contributors (slug, user_id, name_en, name_ar)
    values (candidate_slug, sub.author_id, coalesce(nullif(author.full_name_en, ''), candidate_slug), author.full_name_ar)
    returning id into contributor_id;
  end if;

  base_slug := coalesce(
    nullif(trim(both '-' from regexp_replace(lower(sub.title), '[^a-z0-9]+', '-', 'g')), ''),
    lower(replace(entry.blind_id, 'W-', 'piece-'))
  );
  candidate_slug := left(base_slug, 70);
  n := 1;
  while exists (select 1 from journal.pieces p where p.slug = candidate_slug) loop
    n := n + 1;
    candidate_slug := left(base_slug, 70) || '-' || n;
  end loop;

  insert into journal.pieces
    (issue_id, contributor_id, submission_id, slug, category, language, title_en, title_ar, status)
  values (
    entry.issue_id, contributor_id, sub.id, candidate_slug, sub.category, sub.language,
    case when sub.language = 'ar' then null else sub.title end,
    case when sub.language = 'ar' then sub.title end,
    'draft'
  )
  returning id into piece_id;

  insert into journal.piece_bodies (piece_id, body_en, body_ar)
  values (
    piece_id,
    case when sub.language = 'ar' then null else sub.body_html end,
    case when sub.language = 'ar' then sub.body_html end
  );

  return piece_id;
end;
$$;

revoke all on function journal.piece_from_entry(uuid) from public, anon;
grant execute on function journal.piece_from_entry(uuid) to authenticated, service_role;

-- Accepted work the caller may place in an issue: decided, not yet a piece.
create function journal.accepted_unplaced()
returns table (
  blind_entry_id uuid,
  blind_id text,
  issue_id uuid,
  title text,
  category journal.category,
  language journal.language,
  decision text,
  decided_at timestamptz,
  agreement_signed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.blind_id, b.issue_id, b.title, b.category, b.language,
    d.decision, d.decided_at,
    exists (select 1 from journal.agreements a where a.submission_id = k.submission_id)
  from journal.blind_entries b
  join journal.decisions d on d.blind_entry_id = b.id
  join journal.blind_keys k on k.blind_entry_id = b.id
  where d.decision in ('accept', 'accept_with_edits')
    and not exists (select 1 from journal.pieces p where p.submission_id = k.submission_id)
    and access.has_permission('journal.publish', 'issue', b.issue_id)
  order by d.decided_at;
$$;

revoke all on function journal.accepted_unplaced() from public, anon;
grant execute on function journal.accepted_unplaced() to authenticated, service_role;

-- No piece made from a submission goes out before the agreement is signed.
create function private.before_piece_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('scheduled', 'published')
     and new.submission_id is not null
     and not exists (
       select 1 from journal.agreements a where a.submission_id = new.submission_id
     ) then
    raise exception 'The author has not signed the Publication Agreement'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger before_piece_publish before insert or update of status on journal.pieces
  for each row execute function private.before_piece_publish();

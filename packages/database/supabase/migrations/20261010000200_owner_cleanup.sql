-- Owner's decision (2026-10-09): Shaheen Farjo keeps only the Presidency.
-- Every other role he was given while testing the Nexus is ended (not
-- deleted, so the history stays), including a second President seat. The
-- test content made while building is removed: the "Hey" news draft, the
-- two test submissions to the Issue 1 call (with their blind entries,
-- decision, agreement, files and history), a duplicate member offer and a
-- test verification request. Members, accounts, partners, the Issue 1
-- call, campaigns and rotas are kept. Matches by id only, so it is a no-op
-- on fresh databases.

-- Roles: the President seat held since Oct 4 stays.
update access.role_assignments
set ends_at = greatest(now(), starts_at + interval '1 second')
where user_id = 'e3b58aaf-1814-4701-a569-ce6b318c4697'
  and id <> '226f6a86-6ae8-4807-9042-be0857f2aa45'
  and (ends_at is null or ends_at > now());

-- Test submissions. Blind entries hang off blind_keys, so they go first
-- (their assignments, scores and decisions cascade); the submissions then
-- take their files, agreements and status history with them.
delete from journal.blind_entries
where id in (
  select blind_entry_id from journal.blind_keys
  where submission_id in (
    '9f0cf6a3-8d26-4485-87af-2f23ff861b54',
    'dd85c204-55dd-4e95-8006-949b0b2cc208'
  )
);

delete from journal.submissions
where id in (
  '9f0cf6a3-8d26-4485-87af-2f23ff861b54',
  'dd85c204-55dd-4e95-8006-949b0b2cc208'
);

delete from content.news_posts
where id = 'acb77c7a-4cb7-4833-83bc-97330ad15125';

-- The first copy of the Antiq Typewriter offer (the second, corrected one
-- stays).
delete from governance.member_offers
where id = '1230cf6d-5c78-4849-9ce5-7671d5e5dd8d';

delete from membership.verification_requests
where id = '9740e69f-5765-4c11-8715-4c501e456a4f';

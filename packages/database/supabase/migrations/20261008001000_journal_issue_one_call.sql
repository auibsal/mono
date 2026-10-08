-- The AUIB Literary Journal's first call (owner, Oct 8, 2026): open from
-- today, closing November 26, 2026 as in the Strategic Plan 2026–2029
-- (SAL-STR-01, "A Year in the Society"), which launches Issue 1 on
-- February 24, 2027. Baghdad time. No theme is set (open theme); officers
-- edit the call, its theme and eligibility in the Nexus (Administration →
-- Journal → Calls).

insert into journal.issues (volume, number, slug, title_en, title_ar, status)
values (1, 1, 'issue-1', 'Issue 1', 'العدد الأول', 'draft')
on conflict (volume, number) do nothing;

insert into journal.calls (issue_id, title_en, title_ar, opens_at, closes_at, max_per_person, is_published)
select i.id, 'Issue 1: call for submissions', 'العدد الأول: دعوة للمشاركة',
  '2026-10-08 00:00:00+03', '2026-11-26 23:59:59+03', 2, true
from journal.issues i
where i.volume = 1 and i.number = 1
  and not exists (select 1 from journal.calls c where c.issue_id = i.id);

-- The Arabic name chosen by the owner (Oct 8, 2026); the setting was already
-- changed in Settings.
update core.programmes set name_ar = 'مجلة الجامعة الأمريكية الأدبية' where slug = 'journal';

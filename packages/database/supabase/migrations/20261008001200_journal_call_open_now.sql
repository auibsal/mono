-- The Issue 1 call opens now instead of October 18 (owner, Oct 8, 2026);
-- it still closes November 26, 2026 (Baghdad time).
update journal.calls c
set opens_at = '2026-10-08 00:00:00+03'
from journal.issues i
where i.id = c.issue_id and i.volume = 1 and i.number = 1
  and c.opens_at > '2026-10-08 00:00:00+03';

-- The Arabic name chosen by the owner (Oct 8, 2026); the journal.name_ar
-- setting was already changed in Settings.
update core.programmes set name_ar = 'مجلة الجامعة الأمريكية الأدبية' where slug = 'journal';

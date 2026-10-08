-- The journal's name is the AUIB Literary Journal (owner, 2026-10-08),
-- replacing the working title Waraq. The schema was already `journal`; this
-- renames the program row, the live name settings and a permission
-- description. Arabic «مجلة AUIB الأدبية»: needs native review.
update core.programmes
set slug = 'journal',
    name_en = 'AUIB Literary Journal',
    name_ar = 'مجلة AUIB الأدبية',
    summary_en = replace(summary_en, ' (working title)', ''),
    summary_ar = replace(summary_ar, ' (اسم مؤقت)', '')
where slug = 'waraq';

update core.settings set value = '"AUIB Literary Journal"' where key = 'journal.name_en';
update core.settings set value = '"مجلة AUIB الأدبية"' where key = 'journal.name_ar';

update access.permissions
set description = 'Run the AUIB Literary Journal pipeline: calls, the board, editors'' notes'
where key = 'journal.manage';

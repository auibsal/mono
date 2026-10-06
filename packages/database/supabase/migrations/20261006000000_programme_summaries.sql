-- Programme summaries from the Member Handbook (SAL-MEM-01, "What We Do"),
-- English verbatim. The Arabic was written for the platform
-- (needs-native-review). Also corrects two names against the handbook:
-- Motion Night is a literary debate (not a moving-image night), and the
-- walk is "The Mutanabbi Walk".

update core.programmes p set
  summary_en = s.summary_en,
  summary_ar = s.summary_ar
from (values
  ('waraq', 'Our bilingual literary journal (working title). Submit, or join the masthead.',
    'مجلتنا الأدبية ثنائية اللغة (اسم مؤقت). أرسل عملك، أو انضم إلى هيئة التحرير.'),
  ('side-quest', 'Our campus video series (working title). Be a guest, or join the crew.',
    'سلسلة الفيديو الخاصة بالحرم الجامعي (اسم مؤقت). كن ضيفاً، أو انضم إلى الفريق.'),
  ('second-chapter', 'Every fall: donate books, volunteer at the fair, keep a child warm.',
    'كل خريف: تبرّع بالكتب، وتطوّع في المعرض، وأدفئ طفلاً.'),
  ('typewriter-tour', 'Every spring: six words, one typewriter, the whole campus.',
    'كل ربيع: ست كلمات، وآلة كاتبة واحدة، والحرم الجامعي كله.'),
  ('majlis', 'Monthly salon: a guest, readings, tea, conversation.',
    'صالون شهري: ضيف، وقراءات، وشاي، وحديث.'),
  ('open-pages', 'Writing workshops with editors on hand.',
    'ورش كتابة بحضور المحررين.'),
  ('book-circle', 'One book a month, Arabic and English in turn.',
    'كتاب واحد كل شهر، بالعربية والإنجليزية بالتناوب.'),
  ('scratch-night', 'Try a scene, a poem or a sketch. No pressure.',
    'جرّب مشهداً أو قصيدة أو رسماً. بلا ضغط.'),
  ('bad-poetry-night', 'The worst poem at AUIB wins. Really.',
    'أسوأ قصيدة في الجامعة تفوز. حقاً.'),
  ('motion-night', 'A literary debate once a term.',
    'مناظرة أدبية مرة كل فصل.'),
  ('gallery-wall', 'Your art and photography, on the wall.',
    'فنّك وصورك، على الجدار.'),
  ('mutanabbi-walk', 'A trip to Baghdad''s book street (with approval).',
    'رحلة إلى شارع الكتب في بغداد (بعد الموافقة).')
) as s (slug, summary_en, summary_ar)
where p.slug = s.slug;

update core.programmes set name_ar = 'ليلة المناظرة' where slug = 'motion-night';
update core.programmes set name_en = 'The Mutanabbi Walk' where slug = 'mutanabbi-walk';

-- Reference data the platform needs in every environment: permissions,
-- roles and their permission bundles, programmes, settings and the
-- Second Chapter partner. Mirrored in @repo/rbac (packages/rbac); a test
-- there fails if the two drift apart.
--
-- Arabic names marked "needs-native-review" in PROGRESS.md were written for
-- this platform, not taken from a source document.

insert into access.permissions (key, description) values
  ('members.verify', 'Approve or reject accounts in the verification queue'),
  ('members.manage', 'Manage members: tiers, manual activity records, directory'),
  ('roles.assign', 'Assign and end role assignments'),
  ('events.manage', 'Create and edit events, capacity, waitlists and staff'),
  ('events.checkin', 'Check members in at events'),
  ('content.manage', 'Manage pages, news, homepage slots, announcements and media'),
  ('journal.manage', 'Run the Waraq pipeline: calls, the board, editors'' notes'),
  ('journal.review', 'Be assigned as a blind reader'),
  ('journal.advise', 'Advisory Board: read flagged entries'),
  ('journal.identity.view', 'See who wrote each submission (Submissions Manager)'),
  ('journal.decide', 'Record accept and decline decisions'),
  ('journal.publish', 'Edit and publish issues, pieces and contributors'),
  ('charity.manage', 'Manage campaigns, partners, receipts and impact reports'),
  ('charity.ledger.write', 'Record counted money in the ledger'),
  ('charity.ledger.signoff', 'Sign off ledger entries recorded by someone else'),
  ('programmes.manage', 'Manage programme content, rotas, Six Words and removal requests'),
  ('governance.manage', 'Manage Council terms, the library and governance records'),
  ('governance.minutes.write', 'Write minutes and resolutions'),
  ('elections.manage', 'Run elections (Elections Committee)'),
  ('library.read', 'Read the internal library'),
  ('library.council', 'Read Council-only documents'),
  ('audit.read', 'Read the activity log'),
  ('settings.manage', 'Manage semesters, settings and feature switches'),
  ('spending.request', 'Raise spending requests'),
  ('spending.countersign', 'Countersign spending as Treasurer');

insert into access.roles (key, name_en, name_ar, is_council, spending_limit_iqd, sort) values
  ('president', 'President', 'الرئيس', true, 250000, 10),
  ('vice_president', 'Vice President', 'نائب الرئيس', true, null, 20),
  ('general_secretary', 'General Secretary', 'الأمين العام', true, null, 30),
  ('treasurer', 'Treasurer', 'أمين الصندوق', true, null, 40),
  ('director', 'Director', 'مدير', true, 50000, 50),
  ('faculty_advisor', 'Faculty Advisor', 'المستشار من الهيئة التدريسية', false, null, 60),
  ('elections_committee', 'Elections Committee', 'لجنة الانتخابات', false, null, 70),
  ('eic', 'Editor-in-Chief', 'رئيس التحرير', false, null, 100),
  ('managing_editor', 'Managing Editor', 'مدير التحرير', false, null, 110),
  ('submissions_manager', 'Submissions Manager', 'مسؤول المشاركات', false, null, 120),
  ('section_editor', 'Section Editor', 'محرر القسم', false, null, 130),
  ('arabic_editor', 'Arabic Editor', 'محرر القسم العربي', false, null, 140),
  ('reader', 'Reader', 'قارئ', false, null, 150),
  ('copy_editor', 'Copy Editor', 'المدقق اللغوي', false, null, 160),
  ('digital_editor', 'Digital Editor', 'المحرر الرقمي', false, null, 170),
  ('art_director', 'Art Director', 'المدير الفني', false, null, 180),
  ('layout_designer', 'Layout Designer', 'مصمم الإخراج', false, null, 190),
  ('communications_lead', 'Communications Lead', 'مسؤول التواصل', false, null, 200),
  ('events_lead', 'Events Lead', 'مسؤول الفعاليات', false, null, 210),
  ('advisory_board', 'Advisory Board', 'الهيئة الاستشارية', false, null, 220),
  ('programme_lead', 'Programme Lead', 'قائد البرنامج', false, null, 300),
  ('event_staff', 'Event Staff', 'فريق الفعالية', false, null, 310),
  ('campaign_lead', 'Campaign Lead', 'قائد الحملة', false, null, 320),
  ('tech_admin', 'Technical Administrator', 'المسؤول التقني', false, null, 400);

insert into access.role_permissions (role, permission)
select role, permission from (values
  ('president', array['members.verify', 'members.manage', 'roles.assign', 'events.manage',
    'events.checkin', 'content.manage', 'journal.manage', 'charity.manage',
    'programmes.manage', 'governance.manage', 'library.read', 'library.council',
    'audit.read', 'settings.manage', 'spending.request']),
  ('vice_president', array['members.verify', 'members.manage', 'events.manage',
    'events.checkin', 'content.manage', 'programmes.manage', 'governance.manage',
    'library.read', 'library.council', 'spending.request']),
  ('general_secretary', array['members.verify', 'members.manage', 'content.manage',
    'governance.manage', 'governance.minutes.write', 'library.read', 'library.council',
    'audit.read', 'spending.request']),
  ('treasurer', array['charity.manage', 'charity.ledger.write', 'charity.ledger.signoff',
    'spending.request', 'spending.countersign', 'library.read', 'library.council',
    'audit.read']),
  ('director', array['events.checkin', 'library.read', 'library.council', 'spending.request']),
  ('faculty_advisor', array['library.read', 'library.council', 'audit.read']),
  ('elections_committee', array['elections.manage']),
  ('eic', array['journal.manage', 'journal.decide', 'journal.publish', 'library.read']),
  ('managing_editor', array['journal.manage', 'journal.decide', 'journal.publish', 'library.read']),
  ('submissions_manager', array['journal.identity.view', 'library.read']),
  ('section_editor', array['journal.manage', 'library.read']),
  ('arabic_editor', array['journal.manage', 'library.read']),
  ('reader', array['journal.review', 'library.read']),
  ('copy_editor', array['journal.publish', 'library.read']),
  ('digital_editor', array['journal.publish', 'content.manage', 'library.read']),
  ('art_director', array['journal.publish', 'library.read']),
  ('layout_designer', array['journal.publish', 'library.read']),
  ('communications_lead', array['content.manage', 'library.read']),
  ('events_lead', array['events.manage', 'events.checkin', 'library.read']),
  ('advisory_board', array['journal.advise']),
  ('programme_lead', array['events.manage', 'events.checkin', 'programmes.manage',
    'content.manage', 'library.read']),
  ('event_staff', array['events.checkin']),
  ('campaign_lead', array['charity.manage', 'charity.ledger.write', 'library.read']),
  ('tech_admin', array['members.verify', 'settings.manage', 'audit.read', 'content.manage'])
) as bundles (role, permissions),
lateral unnest(permissions) as permission;

insert into core.programmes (slug, kind, name_en, name_ar, sort) values
  ('waraq', 'journal', 'Waraq', 'ورق', 10),
  ('side-quest', 'series', 'Side Quest', 'سايد كويست', 20),
  ('second-chapter', 'charity', 'Second Chapter', 'الفصل الثاني', 30),
  ('typewriter-tour', 'tour', 'Typewriter Tour', 'جولة الآلة الكاتبة', 40),
  ('majlis', 'format', 'The Majlis', 'المجلس', 50),
  ('open-pages', 'format', 'Open Pages', 'صفحات مفتوحة', 60),
  ('book-circle', 'format', 'Book Circle', 'حلقة الكتاب', 70),
  ('scratch-night', 'format', 'Scratch Night', 'ليلة المسوّدات', 80),
  ('motion-night', 'format', 'Motion Night', 'ليلة الصورة المتحركة', 90),
  ('bad-poetry-night', 'format', 'Bad Poetry Night', 'ليلة الشعر الرديء', 100),
  ('gallery-wall', 'format', 'Gallery Wall', 'جدار المعرض', 110),
  ('mutanabbi-walk', 'format', 'Mutanabbi Walk', 'جولة المتنبي', 120);

insert into core.settings (key, value, is_public, description) values
  ('journal.name_en', '"Waraq"', true, 'Journal name (English). Final choice due Oct 15.'),
  ('journal.name_ar', '"ورق"', true, 'Journal name (Arabic).'),
  ('journal.agreement.version', '"1"', true, 'Current Publication Agreement version.'),
  ('pledges.human_authorship.version', '"1"', true, 'Current Human Authorship pledge version.'),
  ('pledges.member.version', '"1"', true, 'Current Member Pledge (SAL-POL-01) version.'),
  ('charity.cost_per_winter_set_iqd', '40000', true,
    'Cost of one child''s winter set. To be confirmed by Natrok Athar.'),
  ('auib.calendar_url', 'null', false, 'AUIB public calendar (iCal URL), synced hourly.'),
  ('features.elections', 'false', true, 'Online elections. Off until the Committee decides.');

insert into charity.partners (slug, name_ar, name_en) values
  ('natrok-athar', 'نترك اثر', 'Natrok Athar');

-- First admin: makes the Founder President (global) when no president
-- exists yet. Service role only; run once per environment:
--   select access.bootstrap_founder('<email>');
create function access.bootstrap_founder(email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  new_id uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(bootstrap_founder.email);
  if uid is null then
    raise exception 'No account for %; sign up first', email using errcode = 'P0002';
  end if;
  if exists (
    select 1 from access.role_assignments a
    where a.role = 'president' and (a.ends_at is null or a.ends_at > now())
  ) then
    raise exception 'A president is already assigned' using errcode = '23505';
  end if;

  perform private.verify_user(uid);
  insert into access.role_assignments (user_id, role, title_en, title_ar, note)
  values (uid, 'president', 'Founder & President', 'المؤسس والرئيس', 'founder-pre-election')
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function access.bootstrap_founder(text) from public, anon, authenticated;
grant execute on function access.bootstrap_founder(text) to service_role;

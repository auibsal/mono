-- Productions: the rights gate, auditions with private notes, credits a
-- member chooses to show, partners under a memorandum, hours and
-- certificates, and the Program Report (F-25).
begin;
-- <preamble>
-- Shared pgTAP preamble. Each test file includes a copy (pg_prove runs files
-- in isolation); keep them identical. `bun run --cwd packages/database db:test:sync` rewrites them.
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

create function pg_temp.login_as(uid uuid, extra jsonb default '{}')
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config(
    'request.jwt.claims',
    -- aal2 by default (two-step sign-in done); pass '{"aal":"aal1"}' to test without it.
    (jsonb_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2') || extra)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.login_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- A confirmed account. AUIB addresses are verified by the sign-up trigger.
create function pg_temp.make_user(uid uuid, email text, name text default 'Test User')
returns uuid
language sql
as $$
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (uid, email, now(), jsonb_build_object('full_name_en', name), 'authenticated', 'authenticated')
  returning id;
$$;

create function pg_temp.grant_role(uid uuid, role_key text, kind text default 'global', scope uuid default null)
returns void
language sql
as $$
  insert into access.role_assignments (user_id, role, scope_type, scope_id)
  values (uid, role_key, kind, scope);
$$;

grant execute on all functions in schema pg_temp to public;

-- Semesters around today: older, previous, current.
insert into core.semesters (code, name_en, name_ar, starts_on, ends_on) values
  ('fall-2024', 'Older', 'أقدم', current_date - 420, current_date - 300),
  ('spring-2025', 'Previous', 'السابق', current_date - 200, current_date - 60),
  ('fall-2025', 'Current', 'الحالي', current_date - 30, current_date + 60);

-- Tests check the two-activity rule; the founding-voter tests turn the
-- first-100 rule back on themselves.
update core.settings set value = '0' where key = 'membership.founding_voters';
-- </preamble>
select plan(33);

-- a1 is credited, a5 auditions, a4 leads one production, a6 is the Vice
-- President (who clears rights), a2 the President.
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'cast-pr@auib.edu.iq', 'Cast Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'president-pr@auib.edu.iq', 'The President');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'lead-pr@auib.edu.iq', 'Production Lead');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a5', 'actor-pr@auib.edu.iq', 'Hopeful Actor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a6', 'vp-pr@auib.edu.iq', 'Vice President');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'president');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a6', 'vice_president');

insert into membership.memberships (user_id)
select u from unnest(array['00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a5']::uuid[]) u
on conflict do nothing;

-- A partner whose memorandum grants productions, and one whose does not.
insert into governance.partners (id, slug, name_en, kind, status, is_listed) values
  ('00000000-0000-0000-0000-00000000d001', 'stage-reads', 'Stage Reads', 'cultural', 'active', true),
  ('00000000-0000-0000-0000-00000000d002', 'zine-only', 'Zine Only', 'media', 'active', true);
insert into governance.partner_agreements (id, partner_id, purpose_en, starts_on, grants) values
  ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d001',
   'Productions together.', current_date - 1, '{productions}'),
  ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-00000000d002',
   'Shared branding.', current_date - 1, '{shared_branding}');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select governance.sign_partner_agreement('00000000-0000-0000-0000-00000000d101', 'Partner Head', 'partners/a.pdf');
select governance.sign_partner_agreement('00000000-0000-0000-0000-00000000d102', 'Partner Head', 'partners/b.pdf');
select pg_temp.logout();

insert into events.events (id, slug, title_en, title_ar, starts_at, status, published_at) values
  ('00000000-0000-0000-0000-00000000e001', 'reading-night', 'Reading night', 'ليلة القراءة',
   now() + interval '20 days', 'published', now());

-- ── Proposing and the stage gate ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a6');
select lives_ok(
  $$ insert into programmes.productions (id, slug, title_en, title_ar, playwright, script_origin)
     values ('00000000-0000-0000-0000-00000000f001', 'the-reading', 'The Reading', 'القراءة',
       'A Member', 'original') $$,
  'The Vice President proposes a production'
);
select throws_ok(
  $$ insert into programmes.productions (slug, title_en, title_ar, stage)
     values ('skip-ahead', 'Skip', 'تخطي', 'performances') $$,
  '22023', 'production_starts_as_proposal',
  'and it starts as a proposal'
);
insert into programmes.productions (id, slug, title_en, title_ar)
values ('00000000-0000-0000-0000-00000000f002', 'other-show', 'Other show', 'عرض آخر');
select pg_temp.logout();

select lives_ok(
  $$ select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a4', 'production_lead', 'production',
       '00000000-0000-0000-0000-00000000f001') $$,
  'A Production Lead is assigned for one production'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from programmes.productions), 1,
  'The lead sees only their own production');
select lives_ok(
  $$ update programmes.productions set stage = 'approved', rights_note = 'Written consent from the author, Oct 1.'
     where id = '00000000-0000-0000-0000-00000000f001' $$,
  'The lead records what the rights rest on'
);
select is((select rights_recorded_by from programmes.productions where id = '00000000-0000-0000-0000-00000000f001'),
  '00000000-0000-0000-0000-0000000000a4'::uuid, 'and is recorded as having done so');
select throws_ok(
  $$ update programmes.productions set rights_status = 'cleared'
     where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', 'through_rpc',
  'Rights are not cleared through the table'
);
select throws_ok(
  $$ update programmes.productions set stage = 'performances'
     where id = '00000000-0000-0000-0000-00000000f001' $$,
  '22023', 'rights_not_cleared',
  'No performances until the rights are cleared'
);
select throws_ok(
  $$ insert into programmes.production_events values
     ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001') $$,
  '22023', 'rights_not_cleared',
  'and no performance is linked'
);
select throws_ok(
  $$ select programmes.clear_production_rights('00000000-0000-0000-0000-00000000f001') $$,
  '42501', 'someone_else_clears',
  'Whoever recorded the rights does not clear them'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a6');
select lives_ok(
  $$ select programmes.clear_production_rights('00000000-0000-0000-0000-00000000f001') $$,
  'Someone else clears them'
);
update programmes.productions set script_origin = 'licensed'
where id = '00000000-0000-0000-0000-00000000f002';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
update programmes.productions set rights_note = 'Licensed from the publisher.'
where id = '00000000-0000-0000-0000-00000000f002';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a6');
select throws_ok(
  $$ select programmes.clear_production_rights('00000000-0000-0000-0000-00000000f002') $$,
  '22023', 'license_not_on_file',
  'A licensed script needs the license on file'
);

-- ── Auditions and private notes ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
update programmes.productions set stage = 'auditions' where id = '00000000-0000-0000-0000-00000000f001';
insert into programmes.auditions (id, production_id, starts_at, ends_at, capacity)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000f001',
  now() + interval '2 days', now() + interval '2 days 2 hours', 1);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from programmes.auditions), 1, 'Members see open auditions');
select lives_ok(
  $$ select programmes.sign_up_for_audition('00000000-0000-0000-0000-00000000a001', 'Hamlet, Act 3') $$,
  'and sign up'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select programmes.sign_up_for_audition('00000000-0000-0000-0000-00000000a001') $$,
  '23514', 'audition_full',
  'A full audition takes no more'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
insert into programmes.audition_notes (audition_id, user_id, note)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'Strong voice; call back.');
update programmes.audition_signups set status = 'called_back'
where user_id = '00000000-0000-0000-0000-0000000000a5';
select is((select count(*)::int from programmes.audition_notes), 1, 'The panel keeps notes');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from programmes.audition_notes), 0,
  'which the person auditioning never sees');
select is((select status from programmes.audition_signups), 'called_back',
  'though they see their own call-back');
update programmes.audition_signups set status = 'cast';
select is((select status from programmes.audition_signups), 'called_back',
  'and cannot cast themselves');

-- ── Credits, rehearsals and the company ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$ insert into programmes.production_credits (production_id, user_id, department, role_en, show_publicly)
     values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', 'cast', 'Ophelia', true) $$,
  '42501', 'member_chooses',
  'Only the member decides to show their name'
);
insert into programmes.production_credits (id, production_id, user_id, department, role_en)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001',
  '00000000-0000-0000-0000-0000000000a1', 'cast', 'Ophelia');
insert into programmes.production_credits (production_id, person_name, partner_id, department, role_en, show_publicly)
values ('00000000-0000-0000-0000-00000000f001', 'Guest Actor', '00000000-0000-0000-0000-00000000d001',
  'cast', 'Hamlet', true);
insert into programmes.rehearsals (production_id, starts_at, ends_at, called)
values ('00000000-0000-0000-0000-00000000f001', now() + interval '5 days', now() + interval '5 days 3 hours', 'Full company');
update programmes.productions set stage = 'rehearsals', is_public = true
where id = '00000000-0000-0000-0000-00000000f001';

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from programmes.productions), 1, 'The company reads its production');
select is((select count(*)::int from programmes.rehearsals), 1, 'and its rehearsals');
select lives_ok(
  $$ select programmes.set_credit_visibility('00000000-0000-0000-0000-00000000c001', true) $$,
  'A member shows their name on the public page'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from programmes.rehearsals), 0, 'Others do not see the rehearsals');

select pg_temp.login_anon();
select is((select count(*)::int from programmes.public_production_credits('00000000-0000-0000-0000-00000000f001')), 2,
  'The public page credits the people who agreed');
select throws_ok(
  $$ select * from programmes.productions $$,
  '42501', null,
  'and never reads the register itself (rights, report)'
);

-- ── Partners, performances, hours, certificates and the report ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$ insert into programmes.production_partners (production_id, partner_id)
     values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d002') $$,
  '22023', 'partner_not_granted',
  'A partner co-produces only under a memorandum granting productions'
);
insert into programmes.production_partners (production_id, partner_id)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001');
update programmes.productions set stage = 'performances' where id = '00000000-0000-0000-0000-00000000f001';
insert into programmes.production_events values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001');
select lives_ok(
  $$ select programmes.record_production_service('00000000-0000-0000-0000-00000000f001',
       '00000000-0000-0000-0000-0000000000a1', 12.5) $$,
  'The lead records a credited member''s hours'
);
select throws_ok(
  $$ select programmes.record_production_service('00000000-0000-0000-0000-00000000f001',
       '00000000-0000-0000-0000-0000000000a5', 2) $$,
  '22023', 'not_credited',
  'only for people credited'
);
select pg_temp.login_anon();
select is((select count(*)::int from programmes.public_production_events('00000000-0000-0000-0000-00000000f001')), 1,
  'Performances appear publicly once the rights are cleared');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
update programmes.productions set stage = 'closed' where id = '00000000-0000-0000-0000-00000000f001';
select throws_ok(
  $$ select programmes.sign_production_report('00000000-0000-0000-0000-00000000f001') $$,
  '22023', 'report_incomplete',
  'The Program Report (F-25) is signed only when complete'
);
update programmes.productions set report_people_reached = 80, report_what_happened = 'Two readings.',
  report_lessons = 'Book the hall early.', report_repeat = 'Yes, in spring.'
where id = '00000000-0000-0000-0000-00000000f001';
select programmes.sign_production_report('00000000-0000-0000-0000-00000000f001');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is(programmes.draft_production_certificates('00000000-0000-0000-0000-00000000f001'), 1,
  'A closed production drafts a certificate for each credited member');
select is(programmes.draft_production_certificates('00000000-0000-0000-0000-00000000f001'), 0,
  'and only once');

select * from finish();
rollback;

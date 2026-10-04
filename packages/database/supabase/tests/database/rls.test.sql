-- Row Level Security tests. Run with `bun run db:test` (supabase test db).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(55);

-- ── Helpers ─────────────────────────────────────────────────────────────────

create function pg_temp.login_as(user_id uuid, extra jsonb default '{}')
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    (jsonb_build_object('sub', user_id, 'role', 'authenticated') || extra)::text,
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
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- ── Fixtures (as the superuser) ─────────────────────────────────────────────
-- A owns org one, B is a member of org one, C owns org two, D is invited.

insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.iq', '9647700000001', '{"full_name":"Owner A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.iq', '9647700000002', '{"full_name":"Member B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.iq', '9647700000003', '{"full_name":"Owner C","locale":"xx"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.iq', '9647700000004', '{}');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Org One', 'org-one', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', 'Org Two', 'org-two', '00000000-0000-0000-0000-00000000000c');

insert into public.memberships (organization_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'owner');

insert into public.projects (organization_id, name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'One project', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', 'Two project', '00000000-0000-0000-0000-00000000000c');

insert into public.plans (id, name, amount, billing_interval)
values ('test-plan', 'Test', 25000, 'month');

insert into public.subscriptions (organization_id, plan_id, status, provider)
values ('10000000-0000-0000-0000-000000000001', 'test-plan', 'active', 'wayl');

insert into public.payments (organization_id, reference_id, provider, amount)
values ('10000000-0000-0000-0000-000000000001', 'order-1', 'wayl', 25000);

insert into public.webhook_events (provider, event_key, payload)
values ('wayl', 'evt-1', '{}');

insert into public.invitations (id, organization_id, invitee, role, token, invited_by) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '+9647700000004',
  'member',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000a'
);

-- ── Profiles ────────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.profiles
   where id::text like '00000000-0000-0000-0000-00000000000_'),
  4,
  'a profile is created for every new auth user'
);
select is(
  (select locale from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'ar',
  'unsupported locale metadata falls back to ar'
);

-- ── Member B ────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');

select results_eq(
  'select slug from public.organizations',
  array['org-one'],
  'members only see their own organizations'
);
select results_eq(
  'select name from public.projects',
  array['One project'],
  'members only see their organization''s projects'
);
select is(
  (select count(*)::int from public.profiles),
  2,
  'members see their own and teammates'' profiles'
);
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c' $$,
  'members cannot see profiles outside their organizations'
);
select lives_ok(
  $$ insert into public.projects (organization_id, name, created_by)
     values ('10000000-0000-0000-0000-000000000001', 'B project', '00000000-0000-0000-0000-00000000000b') $$,
  'members can create projects in their organization'
);
select throws_ok(
  $$ insert into public.projects (organization_id, name, created_by)
     values ('10000000-0000-0000-0000-000000000002', 'Intrusion', '00000000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'members cannot create projects in other organizations'
);
select throws_ok(
  $$ insert into public.projects (organization_id, name, created_by)
     values ('10000000-0000-0000-0000-000000000001', 'Spoofed', '00000000-0000-0000-0000-00000000000a') $$,
  '42501',
  null,
  'members cannot create projects on behalf of someone else'
);
select throws_ok(
  $$ update public.projects set organization_id = '10000000-0000-0000-0000-000000000002'
     where name = 'One project' $$,
  '42501',
  null,
  'projects cannot be moved to another organization'
);
select is_empty(
  $$ update public.organizations set name = 'Hijacked'
     where id = '10000000-0000-0000-0000-000000000001' returning id $$,
  'members cannot rename the organization'
);
select throws_ok(
  $$ insert into public.memberships (organization_id, user_id, role)
     values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'owner') $$,
  '42501',
  null,
  'nobody can add memberships directly'
);
select is_empty(
  $$ update public.memberships set role = 'owner'
     where user_id = '00000000-0000-0000-0000-00000000000b' returning user_id $$,
  'members cannot promote themselves'
);
select is_empty(
  'select 1 from public.invitations',
  'members cannot see invitations or their tokens'
);
select results_eq(
  'select status::text from public.subscriptions',
  array['active'],
  'members see their organization''s subscription'
);
select is_empty(
  'select 1 from public.payments',
  'members cannot see payments (owners and admins only)'
);
select throws_ok(
  $$ insert into public.payments (organization_id, reference_id, provider, amount)
     values ('10000000-0000-0000-0000-000000000001', 'forged', 'wayl', 1000) $$,
  '42501',
  null,
  'users cannot create payments'
);
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$,
  '42501',
  null,
  'users cannot change subscriptions'
);
select throws_ok(
  'select * from public.webhook_events',
  '42501',
  null,
  'webhook events are server-only'
);
select throws_ok(
  $$ select public.accept_invitation('30000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'an invitation cannot be accepted by a different account'
);
select is_empty(
  'select 1 from public.pending_invitations()',
  'users only see invitations addressed to them'
);

-- ── Owner A ─────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

select isnt_empty(
  $$ update public.organizations set name = 'Org One Renamed'
     where id = '10000000-0000-0000-0000-000000000001' returning id $$,
  'owners can rename the organization'
);
select results_eq(
  'select reference_id from public.payments',
  array['order-1'],
  'owners see payments'
);
select lives_ok(
  $$ insert into public.invitations (organization_id, invitee, role, invited_by)
     values ('10000000-0000-0000-0000-000000000001', 'new@example.iq', 'admin', '00000000-0000-0000-0000-00000000000a') $$,
  'owners can invite people'
);
select throws_ok(
  $$ insert into public.invitations (organization_id, invitee, role, invited_by)
     values ('10000000-0000-0000-0000-000000000001', 'boss@example.iq', 'owner', '00000000-0000-0000-0000-00000000000a') $$,
  '23514',
  null,
  'invitations cannot grant the owner role'
);
select isnt_empty(
  $$ update public.memberships set role = 'admin'
     where user_id = '00000000-0000-0000-0000-00000000000b' returning user_id $$,
  'owners can change members'' roles'
);
select throws_ok(
  $$ update public.memberships set role = 'member'
     where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514',
  'An organization must keep at least one owner',
  'the last owner cannot step down'
);

-- ── Admin B (promoted above) ────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');

select is_empty(
  $$ delete from public.memberships
     where user_id = '00000000-0000-0000-0000-00000000000a' returning user_id $$,
  'admins cannot remove owners'
);

-- ── Invitee D ───────────────────────────────────────────────────────────────

select pg_temp.login_as(
  '00000000-0000-0000-0000-00000000000d',
  '{"phone":"9647700000004"}'
);

select results_eq(
  'select organization_name, role::text from public.pending_invitations()',
  $$ values ('Org One Renamed', 'member') $$,
  'invitees see the invitations addressed to their phone number'
);
select is(
  public.accept_invitation('30000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the invited phone number can accept the invitation'
);
select results_eq(
  'select slug from public.organizations',
  array['org-one'],
  'accepting an invitation grants access to the organization'
);
select throws_ok(
  $$ select public.accept_invitation('30000000-0000-0000-0000-000000000001') $$,
  'P0002',
  null,
  'an invitation can only be used once'
);
select is_empty(
  'select 1 from public.pending_invitations()',
  'accepted invitations are no longer pending'
);

-- ── Owner C (other tenant) ──────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');

select results_eq(
  'select name from public.projects',
  array['Two project'],
  'other tenants cannot see the organization''s projects'
);
select is_empty(
  $$ delete from public.organizations
     where id = '10000000-0000-0000-0000-000000000001' returning id $$,
  'other tenants cannot delete the organization'
);
select lives_ok(
  $$ select public.create_organization('Org Three', 'org-three') $$,
  'users can create organizations'
);
select results_eq(
  $$ select m.role::text from public.memberships m
     join public.organizations o on o.id = m.organization_id
     where o.slug = 'org-three' $$,
  array['owner'],
  'the creator becomes the owner'
);
select throws_ok(
  $$ select public.create_organization('Duplicate', 'org-one') $$,
  '23505',
  null,
  'organization slugs are unique'
);

-- ── Anonymous ───────────────────────────────────────────────────────────────

select pg_temp.login_anon();

select isnt_empty('select 1 from public.plans', 'anyone can see active plans');
select throws_ok(
  'select * from public.organizations',
  '42501',
  null,
  'anonymous visitors cannot read organizations'
);
select throws_ok(
  'select * from public.pending_invitations()',
  '42501',
  null,
  'anonymous visitors cannot list invitations'
);

-- ── Storage ─────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('org-files', '10000000-0000-0000-0000-000000000001/report.pdf') $$,
  'members can upload to their organization''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('org-files', '10000000-0000-0000-0000-000000000002/intrusion.pdf') $$,
  '42501',
  null,
  'members cannot upload to other organizations'' folders'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('org-files', 'not-a-uuid/file.pdf') $$,
  '42501',
  null,
  'paths that are not organization folders are rejected, not errors'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '00000000-0000-0000-0000-00000000000b/me.png') $$,
  'users can upload their own avatar'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'org-files' $$,
  'other tenants cannot see the organization''s files'
);

-- ── Account deletion ────────────────────────────────────────────────────────
-- Org One: A owner, B admin, D member. Org Two and Org Three: C alone.

select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');

select results_eq(
  'select slug, other_members from public.account_deletion_blockers()',
  $$ values ('org-three', 0::bigint), ('org-two', 0::bigint) $$,
  'sole owners see the organizations that block deleting their account'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');

select is_empty(
  'select 1 from public.account_deletion_blockers()',
  'members and admins have nothing to resolve before deleting their account'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

select results_eq(
  'select slug, other_members from public.account_deletion_blockers()',
  $$ values ('org-one', 2::bigint) $$,
  'other members are counted so ownership can be handed over'
);
select isnt_empty(
  $$ update public.memberships set role = 'owner'
     where organization_id = '10000000-0000-0000-0000-000000000001'
       and user_id = '00000000-0000-0000-0000-00000000000b'
     returning user_id $$,
  'owners can make another member an owner'
);
select is_empty(
  'select 1 from public.account_deletion_blockers()',
  'with a co-owner the account can be deleted'
);

select pg_temp.login_anon();

select throws_ok(
  'select * from public.account_deletion_blockers()',
  '42501',
  null,
  'anonymous visitors cannot call account_deletion_blockers'
);

-- As the service role would (auth.admin.deleteUser).
reset role;

select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000c' $$,
  '23514',
  'An organization must keep at least one owner',
  'the database refuses to delete a sole owner'
);
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'an account whose organizations have another owner can be deleted'
);
select results_eq(
  $$ select user_id::text, role::text from public.memberships
     where organization_id = '10000000-0000-0000-0000-000000000001'
     order by user_id $$,
  $$ values ('00000000-0000-0000-0000-00000000000b', 'owner'),
            ('00000000-0000-0000-0000-00000000000d', 'member') $$,
  'deleting the account removes its memberships and keeps the organization'
);

select * from finish();
rollback;

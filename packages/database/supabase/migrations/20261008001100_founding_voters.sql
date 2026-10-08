-- Founding voters (owner, Oct 8, 2026). For the Society's first year the
-- first 100 Members are Voting Members from the day they join, without the
-- two recorded activities of Constitution 3.3(b) / Bylaws B3.3. Everyone else
-- qualifies the usual way, and after the founding year the rule applies to
-- all. Needs a transitional provision in the Constitution (PROGRESS.md).
--
-- "First 100" counts verified Members (not Honorary or Alumni, who never
-- vote) in the order they joined. Both the number and the end date are
-- settings officers can change.

insert into core.settings (key, value, is_public, description) values
  ('membership.founding_voters', '100', true,
   'How many of the first Members vote without the two-activity rule during the founding year.'),
  ('membership.founding_voters_until', '"2027-05-13"', true,
   'Last day (Baghdad) of the founding-voter rule: the end of Spring 2027.')
on conflict (key) do nothing;

create function private.is_founding_voter(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with config as (
    select
      coalesce((private.setting('membership.founding_voters') #>> '{}')::integer, 0) as places,
      (private.setting('membership.founding_voters_until') #>> '{}')::date as until
  ),
  founders as (
    select m.user_id
    from membership.memberships m
    join core.profiles p on p.id = m.user_id
    where p.verified_at is not null and m.tier in ('member', 'fellow')
    order by m.member_since, m.created_at, m.user_id
    limit (select places from config)
  )
  select coalesce(private.today() <= (select until from config), false)
    and exists (select 1 from founders f where f.user_id = uid);
$$;

create or replace function private.is_voting_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(uid)
    and (private.activity_count(uid) >= 2 or private.is_founding_voter(uid));
$$;

-- The Home screen says why someone votes.
drop function membership.my_status();
create function membership.my_status()
returns table (
  is_member boolean,
  verified boolean,
  tier membership.tier,
  member_since date,
  activities integer,
  voting_member boolean,
  founding_voter boolean,
  founding_until date,
  pending_pledges membership.pledge_type[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.is_member(),
    exists (select 1 from core.profiles p where p.id = auth.uid() and p.verified_at is not null),
    (select m.tier from membership.memberships m where m.user_id = auth.uid()),
    (select m.member_since from membership.memberships m where m.user_id = auth.uid()),
    private.activity_count(auth.uid()),
    private.is_voting_member(auth.uid()),
    private.is_member(auth.uid()) and private.is_founding_voter(auth.uid()),
    (private.setting('membership.founding_voters_until') #>> '{}')::date,
    array(
      select t from unnest(enum_range(null::membership.pledge_type)) t
      where not exists (
        select 1 from membership.pledges pl
        where pl.user_id = auth.uid()
          and pl.pledge_type = t
          and pl.version = membership.current_pledge_version(t)
      )
    );
$$;

revoke all on function membership.my_status() from public, anon;
grant execute on function membership.my_status() to authenticated, service_role;
revoke all on function private.is_founding_voter(uuid) from public, anon;
grant execute on function private.is_founding_voter(uuid) to authenticated, service_role;

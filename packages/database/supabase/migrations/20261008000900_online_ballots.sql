-- Online ballots under the Elections Code (Bylaws B6), owner's decision of
-- Oct 8, 2026: every election is voted online through the Nexus.
--
-- B6.2  The voter list is the register of Voting Members on the day notice
--       is given, at least one week before nominations open. A new step,
--       governance.give_notice(), freezes it; voting no longer re-reads the
--       register, and only people on the list may stand.
-- B6.7  Voting is restricted to AUIB accounts, one response per person,
--       checked against the voter list.
-- B6.11 Ballot data is kept for one year, then deleted. The results (the
--       rounds and the winner) stay.

-- ── The notice step ─────────────────────────────────────────────────────────

alter table governance.elections
  add column notice_given_at timestamptz;

alter table governance.elections drop constraint elections_status_check;
alter table governance.elections add constraint elections_status_check
  check (status in ('draft', 'notice', 'nominations', 'review', 'voting', 'closed', 'published'));
alter table governance.elections add constraint elections_notice_given_check
  check (status in ('draft') or notice_given_at is not null);

comment on column governance.elections.eligible_count is
  'Number of people on the voter list, frozen when notice was given (B6.2).';

-- Status moves forward one step at a time; notice and voting happen only
-- through their functions (which set notice_given_at and the voter list).
create function private.election_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status = 'notice' and new.notice_given_at is not null)
    or (old.status = 'notice' and new.status = 'nominations')
    or (old.status = 'nominations' and new.status = 'review')
    or (old.status in ('nominations', 'review') and new.status = 'voting')
    or (old.status = 'voting' and new.status = 'closed')
    or (old.status = 'closed' and new.status = 'published')
  ) then
    raise exception 'An election cannot move from % to %', old.status, new.status
      using errcode = '22023';
  end if;
  if old.notice_given_at is not null
     and new.notice_given_at is distinct from old.notice_given_at then
    raise exception 'The notice date cannot change' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger election_transition before update on governance.elections
  for each row execute function private.election_transition();

-- Gives notice: freezes the voter list as the register stands today.
create function governance.give_notice(election_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e governance.elections;
  n integer;
begin
  if not private.elections_enabled() then
    raise exception 'Elections are not enabled' using errcode = '42501';
  end if;
  if not access.has_permission('elections.manage') then
    raise exception 'elections.manage is required' using errcode = '42501';
  end if;
  select * into e from governance.elections where id = give_notice.election_id for update;
  if not found or e.status <> 'draft' then
    raise exception 'Notice can be given only for a draft election' using errcode = '22023';
  end if;
  if not exists (select 1 from governance.positions p where p.election_id = e.id) then
    raise exception 'Add the offices before giving notice' using errcode = '22023';
  end if;
  if e.nominations_open_at < now() + interval '7 days' then
    raise exception 'Notice must be given at least one week before nominations open'
      using errcode = '22023';
  end if;

  insert into governance.voters (election_id, user_id)
  select e.id, m.user_id from membership.memberships m
  where private.is_voting_member(m.user_id)
  on conflict do nothing;
  get diagnostics n = row_count;

  update governance.elections
  set status = 'notice', notice_given_at = now(), eligible_count = n
  where id = e.id;
  return n;
end;
$$;

-- ── Nominations: candidates come from the frozen list ──────────────────────

create or replace function governance.nominate(position_id uuid, statement_en text, statement_ar text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p governance.positions;
  e governance.elections;
  new_id uuid;
  past_terms integer;
begin
  if not private.elections_enabled() then
    raise exception 'Elections are not enabled' using errcode = '42501';
  end if;

  select * into p from governance.positions where id = nominate.position_id;
  select * into e from governance.elections where id = p.election_id;
  if not found or e.status <> 'nominations'
     or now() not between e.nominations_open_at and e.nominations_close_at then
    raise exception 'Nominations are not open' using errcode = '22023';
  end if;
  if not exists (
    select 1 from governance.voters v where v.election_id = e.id and v.user_id = auth.uid()
  ) then
    raise exception 'Only Voting Members on the voter list can stand' using errcode = '42501';
  end if;
  if private.is_elections_committee_member(auth.uid()) then
    raise exception 'Members of the Elections Committee cannot stand' using errcode = '42501';
  end if;

  -- The President may serve at most two terms.
  if p.role_key = 'president' then
    select count(*) into past_terms from access.role_assignments a
    where a.user_id = auth.uid() and a.role = 'president' and a.scope_type = 'global'
      and a.note is distinct from 'founder-pre-election';
    if past_terms >= 2 then
      raise exception 'The President may serve at most two terms' using errcode = '23514';
    end if;
  end if;

  insert into governance.candidates (position_id, user_id, statement_en, statement_ar)
  values (p.id, auth.uid(), nominate.statement_en, nominate.statement_ar)
  returning id into new_id;
  return new_id;
end;
$$;

-- ── Voting opens on the list frozen at notice ──────────────────────────────

create or replace function governance.open_voting(election_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e governance.elections;
begin
  if not private.elections_enabled() then
    raise exception 'Elections are not enabled' using errcode = '42501';
  end if;
  if not access.has_permission('elections.manage') then
    raise exception 'elections.manage is required' using errcode = '42501';
  end if;
  select * into e from governance.elections where id = open_voting.election_id for update;
  if not found or e.status not in ('nominations', 'review') then
    raise exception 'Voting can only open after nominations' using errcode = '22023';
  end if;

  update governance.elections set status = 'voting' where id = e.id;
  return e.eligible_count;
end;
$$;

-- ── One online ballot per AUIB account on the list ─────────────────────────

create or replace function governance.cast_ballot(election_id uuid, choices jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e governance.elections;
  position_key text;
  ranking jsonb;
  choice text;
  seen text[];
  approved_count integer;
begin
  if not private.elections_enabled() then
    raise exception 'Elections are not enabled' using errcode = '42501';
  end if;

  select * into e from governance.elections where id = cast_ballot.election_id;
  if not found or e.status <> 'voting'
     or now() not between e.voting_opens_at and e.voting_closes_at then
    raise exception 'Voting is not open' using errcode = '22023';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and private.is_auib_email(u.email)
  ) then
    raise exception 'Voting needs a confirmed AUIB account (@auib.edu.iq)' using errcode = '42501';
  end if;
  if not exists (
    select 1 from governance.voters v
    where v.election_id = e.id and v.user_id = auth.uid()
  ) then
    raise exception 'You are not on the voter list for this election' using errcode = '42501';
  end if;
  if jsonb_typeof(choices) <> 'object' then
    raise exception 'Invalid ballot' using errcode = '22023';
  end if;

  for position_key, ranking in select * from jsonb_each(choices) loop
    if not exists (
      select 1 from governance.positions p
      where p.id::text = position_key and p.election_id = e.id
    ) or jsonb_typeof(ranking) <> 'array' then
      raise exception 'Invalid ballot' using errcode = '22023';
    end if;

    select count(*) into approved_count from governance.candidates c
    where c.position_id::text = position_key and c.status = 'approved';

    seen := array[]::text[];
    for choice in select jsonb_array_elements_text(ranking) loop
      if choice = any (seen) then
        raise exception 'Each choice may be ranked once' using errcode = '22023';
      end if;
      if choice = 'RON' then
        if approved_count > 1 then
          raise exception 'RON is offered on uncontested races only' using errcode = '22023';
        end if;
      elsif not exists (
        select 1 from governance.candidates c
        where c.id::text = choice and c.position_id::text = position_key and c.status = 'approved'
      ) then
        raise exception 'Invalid ballot' using errcode = '22023';
      end if;
      seen := seen || choice::text;
    end loop;
  end loop;

  -- One ballot per voter: the receipt's primary key refuses a second one.
  insert into governance.ballot_receipts (election_id, user_id) values (e.id, auth.uid());
  insert into governance.ballots (election_id, choices) values (e.id, cast_ballot.choices);
exception
  when unique_violation then
    raise exception 'You have already voted' using errcode = '23505';
end;
$$;

-- ── Retention: ballot data for one year (B6.11) ─────────────────────────────

-- Ballots and receipts stay append-only; the one exception is the yearly
-- purge below, and only for elections that closed more than a year ago.
create function private.guard_ballot_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('sal.ballot_retention', true) = 'on'
     and exists (
       select 1 from governance.elections e
       where e.id = old.election_id and e.voting_closes_at < now() - interval '1 year'
     ) then
    return old;
  end if;
  raise exception '% on %.% is not allowed: the table is append-only',
    tg_op, tg_table_schema, tg_table_name
    using errcode = '42501';
end;
$$;

drop trigger reject_change on governance.ballots;
drop trigger reject_change on governance.ballot_receipts;
create trigger guard_ballot_data before update or delete on governance.ballots
  for each row execute function private.guard_ballot_data();
create trigger guard_ballot_data before update or delete on governance.ballot_receipts
  for each row execute function private.guard_ballot_data();

create function private.purge_expired_ballots()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('sal.ballot_retention', 'on', true);
  delete from governance.ballots b
  using governance.elections e
  where e.id = b.election_id and e.voting_closes_at < now() - interval '1 year';
  get diagnostics n = row_count;
  delete from governance.ballot_receipts r
  using governance.elections e
  where e.id = r.election_id and e.voting_closes_at < now() - interval '1 year';
  delete from governance.voters v
  using governance.elections e
  where e.id = v.election_id and e.voting_closes_at < now() - interval '1 year';
  perform set_config('sal.ballot_retention', 'off', true);
  return n;
end;
$$;

revoke all on function private.purge_expired_ballots() from public, anon, authenticated;
revoke all on function private.guard_ballot_data() from public, anon, authenticated;
revoke all on function private.election_transition() from public, anon, authenticated;

-- 05:15 UTC is 8:15 AM in Baghdad.
select cron.schedule('sal-ballot-retention', '15 5 * * *',
  $$ select private.purge_expired_ballots() $$);

grant execute on function governance.give_notice(uuid) to authenticated, service_role;

-- ── Elections are on ────────────────────────────────────────────────────────

update core.settings set value = 'true' where key = 'features.elections';

-- Governance: Council terms, minutes and resolutions, the spending approvals
-- log, the internal document library, and elections.
--
-- Spending (Bylaws): a lead approver plus the Treasurer, different people.
-- The lead's limit comes from access.roles.spending_limit_iqd (Director
-- 50,000 IQD, President 250,000 IQD). Above every limit, an adopted Council
-- resolution is required and the Treasurer records it.
--
-- Elections: ranked choice, with Re-Open Nominations (RON) on uncontested
-- races. ballot_receipts (who voted) and ballots (what was chosen) are
-- written together in governance.cast_ballot() and share no key, timestamp
-- or ordering: no policy, view or function joins one to the other. Neither
-- table is in the activity log. The elections feature is off until the
-- `features.elections` setting is true.

create schema governance;
grant usage on schema governance to anon, authenticated, service_role;

create table governance.council_terms (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

create table governance.resolutions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^R-[0-9]{4}-[0-9]{2,3}$'),
  title_en text not null,
  title_ar text,
  text_en text not null,
  text_ar text,
  body text not null default 'council' check (body in ('council', 'general_assembly')),
  status text not null default 'draft' check (status in ('draft', 'adopted', 'rejected', 'withdrawn')),
  votes_for integer check (votes_for >= 0),
  votes_against integer check (votes_against >= 0),
  votes_abstain integer check (votes_abstain >= 0),
  adopted_on date,
  minutes_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'adopted') = (adopted_on is not null))
);

create trigger set_updated_at before update on governance.resolutions
  for each row execute function private.set_updated_at();

create table governance.minutes (
  id uuid primary key default gen_random_uuid(),
  body text not null default 'council' check (body in ('council', 'general_assembly')),
  meeting_on date not null,
  title_en text not null,
  title_ar text,
  text_en text not null default '',
  text_ar text,
  status text not null default 'draft' check (status in ('draft', 'adopted')),
  adopted_on date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'adopted') = (adopted_on is not null))
);

create index minutes_meeting_on_idx on governance.minutes (meeting_on desc);

create trigger set_updated_at before update on governance.minutes
  for each row execute function private.set_updated_at();

alter table governance.resolutions
  add constraint resolutions_minutes_id_fkey
  foreign key (minutes_id) references governance.minutes (id) on delete set null;
create index resolutions_minutes_id_idx on governance.resolutions (minutes_id);

create table governance.spending_approvals (
  id uuid primary key default gen_random_uuid(),
  purpose_en text not null check (char_length(purpose_en) between 1 and 500),
  purpose_ar text,
  amount_iqd bigint not null check (amount_iqd > 0),
  programme_id uuid references core.programmes (id) on delete set null,
  campaign_id uuid references charity.campaigns (id) on delete set null,
  resolution_id uuid references governance.resolutions (id),
  requested_by uuid references auth.users (id) on delete set null default auth.uid(),
  lead_approver uuid references auth.users (id),
  lead_limit_iqd bigint,
  treasurer_approver uuid references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  check (lead_approver is null or treasurer_approver is null or lead_approver <> treasurer_approver)
);

create index spending_approvals_status_idx on governance.spending_approvals (status, created_at desc);
create index spending_approvals_programme_id_idx on governance.spending_approvals (programme_id);
create index spending_approvals_campaign_id_idx on governance.spending_approvals (campaign_id);
create index spending_approvals_resolution_id_idx on governance.spending_approvals (resolution_id);

create table governance.library_documents (
  id uuid primary key default gen_random_uuid(),
  code text,
  title_en text not null,
  title_ar text,
  -- 'role': any member holding a role; 'council': the Council only.
  audience text not null check (audience in ('role', 'council')),
  version text not null default '1',
  status text not null default 'draft' check (status in ('draft', 'adopted', 'superseded')),
  -- Private `library` bucket.
  storage_path text not null unique,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on governance.library_documents
  for each row execute function private.set_updated_at();

-- ── Elections ───────────────────────────────────────────────────────────────

create table governance.elections (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ar text not null,
  status text not null default 'draft'
    check (status in ('draft', 'nominations', 'review', 'voting', 'closed', 'published')),
  nominations_open_at timestamptz not null,
  nominations_close_at timestamptz not null,
  voting_opens_at timestamptz not null,
  voting_closes_at timestamptz not null,
  -- Number of eligible voters snapshotted when voting opened.
  eligible_count integer,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nominations_close_at > nominations_open_at),
  check (voting_opens_at >= nominations_close_at),
  check (voting_closes_at > voting_opens_at)
);

create trigger set_updated_at before update on governance.elections
  for each row execute function private.set_updated_at();

create table governance.positions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references governance.elections (id) on delete cascade,
  role_key text not null references access.roles (key),
  title_en text not null,
  title_ar text not null,
  sort integer not null default 0,
  unique (election_id, role_key)
);

create table governance.candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references governance.positions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  statement_en text check (char_length(statement_en) <= 4000),
  statement_ar text check (char_length(statement_ar) <= 4000),
  status text not null default 'nominated'
    check (status in ('nominated', 'approved', 'rejected', 'withdrawn')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (position_id, user_id)
);

create index candidates_user_id_idx on governance.candidates (user_id);

-- Voters eligible when voting opened (Voting Members at that moment).
create table governance.voters (
  election_id uuid not null references governance.elections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (election_id, user_id)
);

create index voters_user_id_idx on governance.voters (user_id);

-- Who has voted. No timestamp, no reference to the ballot.
create table governance.ballot_receipts (
  election_id uuid not null references governance.elections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (election_id, user_id)
);

create index ballot_receipts_user_id_idx on governance.ballot_receipts (user_id);

-- What was chosen. No voter, no timestamp; a random id.
-- choices: { "<position id>": ["<candidate id>" | "RON", …] } in rank order.
create table governance.ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references governance.elections (id) on delete cascade,
  choices jsonb not null check (jsonb_typeof(choices) = 'object')
);

create index ballots_election_id_idx on governance.ballots (election_id);

create table governance.election_results (
  election_id uuid not null references governance.elections (id) on delete cascade,
  position_id uuid not null references governance.positions (id) on delete cascade,
  -- [{ "round": 1, "tallies": { "<candidate id>|RON": n }, "exhausted": n, "eliminated": "…" }]
  rounds jsonb not null,
  winner_candidate_id uuid references governance.candidates (id),
  ron_won boolean not null default false,
  ballots_counted integer not null,
  computed_at timestamptz not null default now(),
  primary key (election_id, position_id)
);

-- ── Helpers ─────────────────────────────────────────────────────────────────

create function private.elections_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting('features.elections') #>> '{}')::boolean, false);
$$;

-- The largest lead-approval limit among the caller's active global roles.
create function private.my_spending_limit()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select max(r.spending_limit_iqd)
  from access.role_assignments a
  join access.roles r on r.key = a.role
  where a.user_id = auth.uid()
    and a.scope_type = 'global'
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now());
$$;

create function private.is_elections_committee_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    where a.user_id = uid
      and rp.permission = 'elections.manage'
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  );
$$;

-- ── Spending approvals ──────────────────────────────────────────────────────

create function governance.request_spending(
  purpose_en text,
  amount_iqd bigint,
  programme_id uuid default null,
  campaign_id uuid default null,
  resolution_id uuid default null,
  purpose_ar text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not access.has_permission('spending.request') then
    raise exception 'spending.request is required' using errcode = '42501';
  end if;

  insert into governance.spending_approvals
    (purpose_en, purpose_ar, amount_iqd, programme_id, campaign_id, resolution_id)
  values
    (request_spending.purpose_en, request_spending.purpose_ar, request_spending.amount_iqd,
     request_spending.programme_id, request_spending.campaign_id, request_spending.resolution_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- Approve as lead (within the caller's limit) or countersign as Treasurer.
-- Raises when the amount is above what the approver pair may approve.
create function governance.approve_spending(approval_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a governance.spending_approvals;
  my_limit bigint := private.my_spending_limit();
  can_countersign boolean := access.has_permission('spending.countersign');
  highest_limit bigint := (select max(spending_limit_iqd) from access.roles);
  council_approved boolean;
begin
  select * into a from governance.spending_approvals where id = approval_id for update;
  if not found then
    raise exception 'Approval not found' using errcode = 'P0002';
  end if;
  if a.status <> 'pending' then
    raise exception 'This request is already %', a.status using errcode = '22023';
  end if;

  council_approved := exists (
    select 1 from governance.resolutions r
    where r.id = a.resolution_id and r.status = 'adopted'
  );

  if a.amount_iqd > highest_limit and not council_approved then
    raise exception 'Spending above % IQD needs an adopted Council resolution', highest_limit
      using errcode = '23514';
  end if;

  if can_countersign and a.treasurer_approver is null then
    if a.lead_approver = auth.uid() then
      raise exception 'The Treasurer and the lead approver must be different people'
        using errcode = '23514';
    end if;
    update governance.spending_approvals set treasurer_approver = auth.uid() where id = a.id;
  elsif my_limit is not null and a.lead_approver is null then
    if a.amount_iqd > my_limit and not council_approved then
      raise exception 'This approver pair may approve up to % IQD', my_limit
        using errcode = '23514';
    end if;
    if a.treasurer_approver = auth.uid() then
      raise exception 'The Treasurer and the lead approver must be different people'
        using errcode = '23514';
    end if;
    update governance.spending_approvals
    set lead_approver = auth.uid(), lead_limit_iqd = my_limit
    where id = a.id;
  else
    raise exception 'You cannot approve this request' using errcode = '42501';
  end if;

  select * into a from governance.spending_approvals where id = approval_id;
  if a.treasurer_approver is not null and (a.lead_approver is not null or council_approved) then
    update governance.spending_approvals set status = 'approved', approved_at = now() where id = a.id;
    return 'approved';
  end if;
  return 'pending';
end;
$$;

create function governance.reject_spending(approval_id uuid, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_spending_limit() is null and not access.has_permission('spending.countersign') then
    raise exception 'You cannot decide this request' using errcode = '42501';
  end if;
  update governance.spending_approvals
  set status = 'rejected', decision_note = note
  where id = approval_id and status = 'pending';
end;
$$;

-- ── Elections RPCs ──────────────────────────────────────────────────────────

create function governance.nominate(position_id uuid, statement_en text, statement_ar text default null)
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
  if not private.is_voting_member(auth.uid()) then
    raise exception 'Only Voting Members can stand' using errcode = '42501';
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

create function governance.decide_candidate(candidate_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not access.has_permission('elections.manage') then
    raise exception 'elections.manage is required' using errcode = '42501';
  end if;
  update governance.candidates
  set status = case when approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where id = candidate_id and status in ('nominated', 'approved', 'rejected');
end;
$$;

-- Opens voting: snapshots every Voting Member at this moment.
create function governance.open_voting(election_id uuid)
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
  select * into e from governance.elections where id = open_voting.election_id for update;
  if e.status not in ('nominations', 'review') then
    raise exception 'Voting can only open after nominations' using errcode = '22023';
  end if;

  insert into governance.voters (election_id, user_id)
  select e.id, m.user_id from membership.memberships m
  where private.is_voting_member(m.user_id)
  on conflict do nothing;
  get diagnostics n = row_count;

  update governance.elections set status = 'voting', eligible_count = n where id = e.id;
  return n;
end;
$$;

create function governance.cast_ballot(election_id uuid, choices jsonb)
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
    select 1 from governance.voters v
    where v.election_id = e.id and v.user_id = auth.uid()
  ) then
    raise exception 'You were not a Voting Member when voting opened' using errcode = '42501';
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

-- Ranked-choice (instant-runoff) count for one position. Ties for last
-- place are broken by fewer first-preference votes, then by fewest
-- candidates' sort order (id) — recorded in the rounds for scrutiny.
create function private.count_position(election_id uuid, position_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  options text[];
  continuing text[];
  rounds jsonb := '[]'::jsonb;
  tallies jsonb;
  round_no integer := 0;
  active_total integer;
  exhausted integer;
  top_option text;
  top_votes integer;
  lowest text;
  first_round jsonb;
  counted integer;
  approved integer;
begin
  select array_agg(c.id::text order by c.id) into options
  from governance.candidates c
  where c.position_id = count_position.position_id and c.status = 'approved';
  options := coalesce(options, array[]::text[]);
  approved := cardinality(options);
  if approved <= 1 then
    options := options || 'RON'::text;
  end if;
  continuing := options;

  select count(*) into counted from governance.ballots b
  where b.election_id = count_position.election_id
    and jsonb_array_length(coalesce(b.choices -> position_id::text, '[]')) > 0;

  loop
    round_no := round_no + 1;

    -- Each ballot's highest-ranked continuing option.
    with firsts as (
      select (
        select r.value
        from jsonb_array_elements_text(coalesce(b.choices -> position_id::text, '[]'))
          with ordinality as r (value, ord)
        where r.value = any (continuing)
        order by r.ord
        limit 1
      ) as pick
      from governance.ballots b
      where b.election_id = count_position.election_id
        and jsonb_array_length(coalesce(b.choices -> position_id::text, '[]')) > 0
    )
    select
      coalesce(jsonb_object_agg(o, coalesce(t.n, 0)), '{}'),
      coalesce(sum(t.n), 0)::integer,
      (select count(*) from firsts where pick is null)::integer
    into tallies, active_total, exhausted
    from unnest(continuing) o
    left join (select pick, count(*)::integer as n from firsts where pick is not null group by pick) t
      on t.pick = o;

    if round_no = 1 then
      first_round := tallies;
    end if;

    select key, value::integer into top_option, top_votes
    from jsonb_each_text(tallies) order by value::integer desc, key limit 1;

    if active_total > 0 and top_votes * 2 > active_total then
      rounds := rounds || jsonb_build_object(
        'round', round_no, 'tallies', tallies, 'exhausted', exhausted, 'elected', top_option);
      exit;
    end if;

    if cardinality(continuing) <= 1 or active_total = 0 then
      rounds := rounds || jsonb_build_object(
        'round', round_no, 'tallies', tallies, 'exhausted', exhausted, 'elected', null);
      top_option := null;
      exit;
    end if;

    select o into lowest from unnest(continuing) o
    order by (tallies ->> o)::integer, coalesce((first_round ->> o)::integer, 0), o
    limit 1;

    rounds := rounds || jsonb_build_object(
      'round', round_no, 'tallies', tallies, 'exhausted', exhausted, 'eliminated', lowest);
    continuing := array_remove(continuing, lowest);
  end loop;

  insert into governance.election_results
    (election_id, position_id, rounds, winner_candidate_id, ron_won, ballots_counted)
  values (
    count_position.election_id,
    count_position.position_id,
    rounds,
    case when top_option is not null and top_option <> 'RON' then top_option::uuid end,
    coalesce(top_option = 'RON', false),
    counted
  )
  on conflict (election_id, position_id) do update
    set rounds = excluded.rounds,
        winner_candidate_id = excluded.winner_candidate_id,
        ron_won = excluded.ron_won,
        ballots_counted = excluded.ballots_counted,
        computed_at = now();
end;
$$;

-- Runs after polls close (Elections Committee); stores round-by-round results.
create function governance.count_election(election_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e governance.elections;
  p governance.positions;
begin
  if not access.has_permission('elections.manage') then
    raise exception 'elections.manage is required' using errcode = '42501';
  end if;
  select * into e from governance.elections where id = count_election.election_id for update;
  if now() < e.voting_closes_at then
    raise exception 'Polls have not closed' using errcode = '22023';
  end if;
  for p in select * from governance.positions where positions.election_id = e.id loop
    perform private.count_position(e.id, p.id);
  end loop;
  update governance.elections set status = 'closed' where id = e.id and status = 'voting';
end;
$$;

-- Turnout, without saying who.
create function governance.turnout(election_id uuid)
returns table (eligible integer, voted integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.eligible_count,
    (select count(*)::integer from governance.ballot_receipts r where r.election_id = e.id)
  from governance.elections e
  where e.id = turnout.election_id and e.status in ('voting', 'closed', 'published');
$$;

-- The Council and Directors, from active role assignments (public).
create function governance.council_roster()
returns table (
  role text,
  role_name_en text,
  role_name_ar text,
  title_en text,
  title_ar text,
  full_name_en text,
  full_name_ar text,
  sort integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.role, r.name_en, r.name_ar, a.title_en, a.title_ar,
    p.full_name_en, p.full_name_ar, r.sort
  from access.role_assignments a
  join access.roles r on r.key = a.role
  join core.profiles p on p.id = a.user_id
  where r.is_council
    and a.scope_type = 'global'
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now())
  order by r.sort, p.full_name_en;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table governance.council_terms enable row level security;
alter table governance.resolutions enable row level security;
alter table governance.minutes enable row level security;
alter table governance.spending_approvals enable row level security;
alter table governance.library_documents enable row level security;
alter table governance.elections enable row level security;
alter table governance.positions enable row level security;
alter table governance.candidates enable row level security;
alter table governance.voters enable row level security;
alter table governance.ballot_receipts enable row level security;
alter table governance.ballots enable row level security;
alter table governance.election_results enable row level security;

create policy "Anyone reads Council terms"
  on governance.council_terms for select to anon, authenticated using (true);
create policy "Governance managers manage Council terms"
  on governance.council_terms for all to authenticated
  using ((select access.has_permission('governance.manage')))
  with check ((select access.has_permission('governance.manage')));

create policy "Anyone reads adopted resolutions"
  on governance.resolutions for select to anon, authenticated
  using (status = 'adopted');
create policy "Minute-takers read and write resolutions"
  on governance.resolutions for all to authenticated
  using (
    (select access.has_permission('governance.minutes.write'))
    or (select access.has_permission('governance.manage'))
  )
  with check (
    (select access.has_permission('governance.minutes.write'))
    or (select access.has_permission('governance.manage'))
  );

create policy "Members read adopted minutes"
  on governance.minutes for select to authenticated
  using (status = 'adopted' and (select membership.is_member()));
create policy "Minute-takers read and write minutes"
  on governance.minutes for all to authenticated
  using (
    (select access.has_permission('governance.minutes.write'))
    or (select access.has_permission('governance.manage'))
  )
  with check (
    (select access.has_permission('governance.minutes.write'))
    or (select access.has_permission('governance.manage'))
  );

create policy "Approvers and governance managers read the spending log"
  on governance.spending_approvals for select to authenticated
  using (
    requested_by = (select auth.uid())
    or (select access.has_permission('governance.manage'))
    or (select access.has_permission('spending.countersign'))
    or (select private.my_spending_limit()) is not null
  );
-- No direct writes: request_spending() and approve_spending() enforce the rules.

create policy "Role holders read the role library"
  on governance.library_documents for select to authenticated
  using (
    (audience = 'role' and (select access.has_permission_anywhere('library.read')))
    or (select access.has_permission('library.council'))
  );
create policy "Governance managers manage the library"
  on governance.library_documents for all to authenticated
  using ((select access.has_permission('governance.manage')))
  with check ((select access.has_permission('governance.manage')));

create policy "Members read elections once announced"
  on governance.elections for select to authenticated
  using (
    (status <> 'draft' and (select membership.is_member()) and (select private.elections_enabled()))
    or (select access.has_permission('elections.manage'))
  );
create policy "The Elections Committee manages elections"
  on governance.elections for all to authenticated
  using ((select access.has_permission('elections.manage')))
  with check ((select access.has_permission('elections.manage')));

create policy "Members read positions of announced elections"
  on governance.positions for select to authenticated
  using (exists (
    select 1 from governance.elections e
    where e.id = election_id
      and ((e.status <> 'draft' and (select membership.is_member()) and (select private.elections_enabled()))
        or (select access.has_permission('elections.manage')))
  ));
create policy "The Elections Committee manages positions"
  on governance.positions for all to authenticated
  using ((select access.has_permission('elections.manage')))
  with check ((select access.has_permission('elections.manage')));

create policy "Members read approved candidates"
  on governance.candidates for select to authenticated
  using (status = 'approved' and (select membership.is_member()) and (select private.elections_enabled()));
create policy "Candidates read their own nominations"
  on governance.candidates for select to authenticated
  using (user_id = (select auth.uid()));
create policy "The Elections Committee reads every nomination"
  on governance.candidates for select to authenticated
  using ((select access.has_permission('elections.manage')));
create policy "Candidates withdraw or edit their statement"
  on governance.candidates for update to authenticated
  using (user_id = (select auth.uid()) and status in ('nominated', 'approved'))
  with check (user_id = (select auth.uid()) and status in ('nominated', 'approved', 'withdrawn'));

create policy "Voters see that they may vote"
  on governance.voters for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Voters see their own receipt"
  on governance.ballot_receipts for select to authenticated
  using (user_id = (select auth.uid()));

-- governance.ballots: no policies and no grants for any client role.

create policy "Members read published results"
  on governance.election_results for select to authenticated
  using (
    exists (
      select 1 from governance.elections e
      where e.id = election_id and e.status = 'published'
    ) and (select membership.is_member())
  );
create policy "The Elections Committee reads results"
  on governance.election_results for select to authenticated
  using ((select access.has_permission('elections.manage')));

revoke all on all tables in schema governance from anon, authenticated;
revoke all on all functions in schema governance from public, anon, authenticated;

grant select on governance.council_terms, governance.resolutions to anon, authenticated;
grant select on governance.minutes, governance.spending_approvals,
  governance.library_documents, governance.elections, governance.positions,
  governance.candidates, governance.voters, governance.ballot_receipts,
  governance.election_results to authenticated;
grant insert, update, delete on governance.council_terms, governance.resolutions,
  governance.minutes, governance.library_documents, governance.elections,
  governance.positions to authenticated;
grant update (statement_en, statement_ar, status) on governance.candidates to authenticated;

grant all on governance.council_terms, governance.resolutions, governance.minutes,
  governance.spending_approvals, governance.library_documents, governance.elections,
  governance.positions, governance.candidates, governance.voters,
  governance.election_results to service_role;
-- Even the service role may only add and count ballots, never edit them.
grant select, insert on governance.ballots, governance.ballot_receipts to service_role;

grant execute on function governance.council_roster() to anon, authenticated, service_role;
grant execute on function
  governance.request_spending(text, bigint, uuid, uuid, uuid, text),
  governance.approve_spending(uuid),
  governance.reject_spending(uuid, text),
  governance.nominate(uuid, text, text),
  governance.decide_candidate(uuid, boolean),
  governance.open_voting(uuid),
  governance.cast_ballot(uuid, jsonb),
  governance.count_election(uuid),
  governance.turnout(uuid)
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger reject_change before update or delete on governance.ballots
  for each row execute function private.reject_change();
create trigger reject_change before update or delete on governance.ballot_receipts
  for each row execute function private.reject_change();

create trigger log_activity after insert or update or delete on governance.resolutions
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.minutes
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.spending_approvals
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.elections
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.candidates
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.election_results
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on governance.library_documents
  for each row execute function private.log_activity();

-- Charity (Second Chapter): partners, campaigns, the append-only ledger with
-- second-person sign-off, receipts and impact metrics.
--
-- • ledger_entries and ledger_signoffs are append-only for everyone: no
--   update or delete policies, no grants, and a trigger that refuses the
--   statement even for the service role. Corrections are reversing entries.
-- • An entry counts only once a second, different user has signed it off.
--   charity.campaign_progress() applies that rule; the Warmth Meter reads it.
-- • No online payments of any kind.

create schema charity;
grant usage on schema charity to anon, authenticated, service_role;

create type charity.source as enum (
  'table_cash',
  'stickers',
  'blind_date',
  'fill_a_bag',
  'book_sales',
  'donation',
  'other'
);

create table charity.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null,
  name_en text not null,
  description_en text,
  description_ar text,
  url text check (url ~ '^https://'),
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on charity.partners
  for each row execute function private.set_updated_at();

create table charity.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  programme_id uuid references core.programmes (id) on delete set null,
  partner_id uuid references charity.partners (id) on delete set null,
  title_en text not null,
  title_ar text not null,
  summary_en text,
  summary_ar text,
  starts_on date,
  ends_on date,
  -- Warmth Meter: children clothed = counted total ÷ cost per winter set.
  cost_per_unit_iqd bigint check (cost_per_unit_iqd > 0),
  unit_label_en text not null default 'children clothed',
  unit_label_ar text not null default 'أطفال كُسوا',
  target_units integer check (target_units > 0),
  -- Display-only price list, e.g. [{ "label_en": "Sticker", "label_ar": "…", "iqd": [3000, 5000, 10000] }].
  price_list jsonb not null default '[]' check (jsonb_typeof(price_list) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index campaigns_programme_id_idx on charity.campaigns (programme_id);
create index campaigns_partner_id_idx on charity.campaigns (partner_id);

create trigger set_updated_at before update on charity.campaigns
  for each row execute function private.set_updated_at();

create table charity.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references charity.campaigns (id),
  -- Positive for money in; negative only for a reversing entry.
  amount_iqd bigint not null check (amount_iqd <> 0),
  source charity.source not null,
  occurred_on date not null default private.today(),
  -- Cash is always counted by two people.
  counted_by uuid not null references auth.users (id),
  counted_with uuid not null references auth.users (id),
  note text check (char_length(note) <= 1000),
  reverses_entry_id uuid unique references charity.ledger_entries (id),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (counted_by <> counted_with),
  check ((amount_iqd < 0) = (reverses_entry_id is not null))
);

create index ledger_entries_campaign_id_idx on charity.ledger_entries (campaign_id, occurred_on);
create index ledger_entries_created_by_idx on charity.ledger_entries (created_by);

create table charity.ledger_signoffs (
  entry_id uuid primary key references charity.ledger_entries (id),
  signed_by uuid not null references auth.users (id) default auth.uid(),
  signed_at timestamptz not null default now()
);

create trigger reject_change before update or delete on charity.ledger_entries
  for each row execute function private.reject_change();
create trigger reject_change before update or delete on charity.ledger_signoffs
  for each row execute function private.reject_change();
create trigger reject_truncate before truncate on charity.ledger_entries
  for each statement execute function private.reject_change();
create trigger reject_truncate before truncate on charity.ledger_signoffs
  for each statement execute function private.reject_change();

-- A reversal must exactly cancel a signed-off-or-not entry of the same
-- campaign, once.
create function private.before_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original charity.ledger_entries;
begin
  if new.reverses_entry_id is not null then
    select * into original from charity.ledger_entries where id = new.reverses_entry_id;
    if not found or original.campaign_id <> new.campaign_id
       or original.amount_iqd <> -new.amount_iqd or original.reverses_entry_id is not null then
      raise exception 'A reversal must cancel one original entry of the same campaign exactly'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_ledger_entry before insert on charity.ledger_entries
  for each row execute function private.before_ledger_entry();

-- The second signer is a different person from whoever recorded the entry.
create function private.before_ledger_signoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from charity.ledger_entries e
    where e.id = new.entry_id and e.created_by = new.signed_by
  ) then
    raise exception 'The second signer must be a different person' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger before_ledger_signoff before insert on charity.ledger_signoffs
  for each row execute function private.before_ledger_signoff();

create table charity.receipts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references charity.campaigns (id) on delete cascade,
  ledger_entry_id uuid references charity.ledger_entries (id),
  description_en text not null,
  description_ar text,
  amount_iqd bigint check (amount_iqd > 0),
  -- Private `receipts` bucket: <campaign id>/<random>.<ext>
  storage_path text not null unique,
  -- Shown on the transparency page (through a signed URL from apps/api).
  is_public boolean not null default false,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path like campaign_id::text || '/%')
);

create index receipts_campaign_id_idx on charity.receipts (campaign_id);
create index receipts_ledger_entry_id_idx on charity.receipts (ledger_entry_id);

create table charity.impact_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references charity.campaigns (id) on delete cascade,
  label_en text not null,
  label_ar text not null,
  value numeric not null,
  unit_en text,
  unit_ar text,
  report_en text,
  report_ar text,
  published_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index impact_metrics_campaign_id_idx on charity.impact_metrics (campaign_id, sort);

create trigger set_updated_at before update on charity.impact_metrics
  for each row execute function private.set_updated_at();

-- ── Counted totals ──────────────────────────────────────────────────────────

-- Counted (signed-off) money and the Warmth Meter for one campaign or all
-- visible campaigns. Public: shows totals, never who counted.
create function charity.campaign_progress(campaign_id uuid default null)
returns table (
  campaign_id uuid,
  counted_iqd bigint,
  pending_iqd bigint,
  cost_per_unit_iqd bigint,
  units integer,
  target_units integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    coalesce(sum(e.amount_iqd) filter (where s.entry_id is not null), 0)::bigint,
    coalesce(sum(e.amount_iqd) filter (where s.entry_id is null), 0)::bigint,
    coalesce(c.cost_per_unit_iqd, (private.setting('charity.cost_per_winter_set_iqd') #>> '{}')::bigint),
    floor(
      coalesce(sum(e.amount_iqd) filter (where s.entry_id is not null), 0)::numeric
      / nullif(coalesce(c.cost_per_unit_iqd, (private.setting('charity.cost_per_winter_set_iqd') #>> '{}')::bigint), 0)
    )::integer,
    c.target_units
  from charity.campaigns c
  left join charity.ledger_entries e on e.campaign_id = c.id
  left join charity.ledger_signoffs s on s.entry_id = e.id
  where (campaign_progress.campaign_id is null or c.id = campaign_progress.campaign_id)
    and (c.status <> 'draft' or access.has_permission('charity.manage', 'campaign', c.id))
  group by c.id;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table charity.partners enable row level security;
alter table charity.campaigns enable row level security;
alter table charity.ledger_entries enable row level security;
alter table charity.ledger_signoffs enable row level security;
alter table charity.receipts enable row level security;
alter table charity.impact_metrics enable row level security;

create policy "Anyone reads partners"
  on charity.partners for select to anon, authenticated using (true);
create policy "Charity managers manage partners"
  on charity.partners for all to authenticated
  using ((select access.has_permission('charity.manage')))
  with check ((select access.has_permission('charity.manage')));

create policy "Anyone reads published campaigns"
  on charity.campaigns for select to anon, authenticated
  using (status <> 'draft');
create policy "Campaign managers read and edit their campaign"
  on charity.campaigns for all to authenticated
  using ((select access.has_permission('charity.manage', 'campaign', id)))
  with check ((select access.has_permission('charity.manage', 'campaign', id)));
create policy "Global charity managers create campaigns"
  on charity.campaigns for insert to authenticated
  with check ((select access.has_permission('charity.manage')));

create policy "Ledger keepers read the ledger"
  on charity.ledger_entries for select to authenticated
  using (
    (select access.has_permission('charity.ledger.write', 'campaign', campaign_id))
    or (select access.has_permission('charity.ledger.signoff', 'campaign', campaign_id))
    or (select access.has_permission('charity.manage', 'campaign', campaign_id))
  );
create policy "Ledger writers record entries counted by two people"
  on charity.ledger_entries for insert to authenticated
  with check (
    (select access.has_permission('charity.ledger.write', 'campaign', campaign_id))
    and created_by = (select auth.uid())
    and (counted_by = (select auth.uid()) or counted_with = (select auth.uid()))
  );

create policy "Ledger keepers read sign-offs"
  on charity.ledger_signoffs for select to authenticated
  using (exists (
    select 1 from charity.ledger_entries e
    where e.id = entry_id and (
      (select access.has_permission('charity.ledger.write', 'campaign', e.campaign_id))
      or (select access.has_permission('charity.ledger.signoff', 'campaign', e.campaign_id))
      or (select access.has_permission('charity.manage', 'campaign', e.campaign_id))
    )
  ));
create policy "Second signers sign off other people's entries"
  on charity.ledger_signoffs for insert to authenticated
  with check (
    signed_by = (select auth.uid())
    and exists (
      select 1 from charity.ledger_entries e
      where e.id = entry_id
        and e.created_by <> (select auth.uid())
        and (select access.has_permission('charity.ledger.signoff', 'campaign', e.campaign_id))
    )
  );

create policy "Anyone reads public receipts"
  on charity.receipts for select to anon, authenticated
  using (is_public);
create policy "Charity managers manage receipts"
  on charity.receipts for all to authenticated
  using ((select access.has_permission('charity.manage', 'campaign', campaign_id)))
  with check ((select access.has_permission('charity.manage', 'campaign', campaign_id)));

create policy "Anyone reads published impact metrics"
  on charity.impact_metrics for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy "Charity managers manage impact metrics"
  on charity.impact_metrics for all to authenticated
  using ((select access.has_permission('charity.manage', 'campaign', campaign_id)))
  with check ((select access.has_permission('charity.manage', 'campaign', campaign_id)));

revoke all on all tables in schema charity from anon, authenticated;
revoke all on all functions in schema charity from public, anon, authenticated;

grant select on charity.partners, charity.campaigns, charity.receipts,
  charity.impact_metrics to anon, authenticated;
grant select on charity.ledger_entries, charity.ledger_signoffs to authenticated;
grant insert, update, delete on charity.partners, charity.campaigns,
  charity.receipts, charity.impact_metrics to authenticated;
-- Insert only: there is no update or delete grant on the ledger for anyone.
grant insert (campaign_id, amount_iqd, source, occurred_on, counted_by,
  counted_with, note, reverses_entry_id)
  on charity.ledger_entries to authenticated;
grant insert (entry_id) on charity.ledger_signoffs to authenticated;

grant select, insert on charity.ledger_entries, charity.ledger_signoffs to service_role;
grant all on charity.partners, charity.campaigns, charity.receipts,
  charity.impact_metrics to service_role;

grant execute on function charity.campaign_progress(uuid) to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

create trigger log_activity after insert on charity.ledger_entries
  for each row execute function private.log_activity();
create trigger log_activity after insert on charity.ledger_signoffs
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on charity.campaigns
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on charity.receipts
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on charity.impact_metrics
  for each row execute function private.log_activity();

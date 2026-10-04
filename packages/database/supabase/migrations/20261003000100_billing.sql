-- Billing: plans, subscriptions, payments and webhook idempotency.
--
-- Members can READ their organization's billing state; only trusted server
-- code (secret key, bypasses RLS) WRITES it — after verifying the payment
-- provider's webhook signature and re-reading the payment from its API.
-- Amounts are integers in the currency's smallest unit; IQD has no minor
-- unit in practice, so amounts are whole dinars.

create type public.billing_interval as enum ('month', 'year');
create type public.subscription_status as enum (
  'incomplete', 'active', 'past_due', 'canceled', 'expired'
);
create type public.payment_status as enum (
  'pending', 'paid', 'failed', 'canceled', 'expired', 'refunded'
);

create table public.plans (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  amount bigint not null check (amount >= 0),
  currency char(3) not null default 'IQD',
  billing_interval public.billing_interval not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_end > current_period_start)
);

-- At most one live subscription per organization.
create unique index subscriptions_one_live_per_org
  on public.subscriptions (organization_id)
  where status in ('incomplete', 'active', 'past_due');
create index subscriptions_renewal_idx
  on public.subscriptions (current_period_end)
  where status in ('active', 'past_due');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- Kept (with a null organization) if the organization is deleted, because
  -- payments are financial records.
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  -- Our order id, sent to the provider and echoed back in webhooks.
  reference_id text not null unique check (char_length(reference_id) between 2 and 255),
  provider text not null,
  provider_payment_id text,
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'IQD',
  status public.payment_status not null default 'pending',
  description text,
  checkout_url text,
  payment_method text,
  paid_at timestamptz,
  refunded_amount bigint not null default 0 check (refunded_amount between 0 and amount),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_organization_id_created_at_idx
  on public.payments (organization_id, created_at desc);
create index payments_subscription_id_idx on public.payments (subscription_id);

-- Every provider webhook is recorded once; a repeated delivery hits the
-- unique constraint and is skipped.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  reference_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key)
);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

create policy "Active plans are public"
  on public.plans for select to anon, authenticated
  using (active);

create policy "Members see their organization's subscription"
  on public.subscriptions for select to authenticated
  using (private.is_org_member(organization_id));

create policy "Owners and admins see payments"
  on public.payments for select to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'));

-- webhook_events: no policies — server-only.

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.plans, public.subscriptions, public.payments,
  public.webhook_events from anon, authenticated;

grant select on public.plans to anon, authenticated;
grant select on public.subscriptions, public.payments to authenticated;

grant all on public.plans, public.subscriptions, public.payments,
  public.webhook_events to service_role;

-- Local development seed (runs after migrations on `supabase db reset`).
-- Prices are in IQD (whole dinars). Adjust to the project's real plans.

insert into public.plans (id, name, description, amount, currency, billing_interval)
values
  ('starter-monthly', 'Starter', 'For individuals and small teams', 25000, 'IQD', 'month'),
  ('pro-monthly', 'Pro', 'For growing businesses', 75000, 'IQD', 'month'),
  ('pro-yearly', 'Pro (yearly)', 'Two months free', 750000, 'IQD', 'year')
on conflict (id) do nothing;

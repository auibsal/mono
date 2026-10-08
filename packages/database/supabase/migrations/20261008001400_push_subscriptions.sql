-- Phone and browser notifications (Web Push, no vendor). A member turns them
-- on per device in Profile and privacy; the browser hands the Nexus an
-- endpoint and two keys, stored here. apps/api sends each outbox notice to
-- the member's devices as well as by email, signed with the Society's VAPID
-- key, and removes a device when its push service says it is gone.

create table core.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  endpoint text not null unique
    check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 64),
  -- "iPhone · Safari", shown in the device list. Set by the Nexus.
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now()
);

comment on table core.push_subscriptions is
  'Web Push endpoints, one per device a member turned notifications on for.';

create index push_subscriptions_user_idx on core.push_subscriptions (user_id);

alter table core.push_subscriptions enable row level security;

create policy "Members read their own devices"
  on core.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members remove their own devices"
  on core.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Adding goes through this function: a browser's endpoint belongs to
-- whoever is signed in on it now, so a shared laptop moves to the new
-- member instead of failing on the unique endpoint.
create function core.save_push_subscription(
  endpoint text,
  p256dh text,
  auth text,
  label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  insert into core.push_subscriptions as s (user_id, endpoint, p256dh, auth, label)
  values ((select auth.uid()), save_push_subscription.endpoint,
    save_push_subscription.p256dh, save_push_subscription.auth,
    save_push_subscription.label)
  on conflict on constraint push_subscriptions_endpoint_key do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        label = excluded.label,
        created_at = now()
  returning s.id into saved;
  return saved;
end;
$$;

revoke all on core.push_subscriptions from anon, authenticated;
grant select, delete on core.push_subscriptions to authenticated;
grant all on core.push_subscriptions to service_role;
revoke all on function core.save_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function core.save_push_subscription(text, text, text, text)
  to authenticated;

-- Places taken on each upcoming shift, for the member Programs page. Members
-- may read only their own sign-ups (RLS), so the count comes from here; it
-- returns numbers, never who signed up. Non-members get no rows.
create function programmes.shift_places()
returns table (shift_id uuid, taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, count(su.user_id)::integer
  from programmes.shifts s
  left join programmes.shift_signups su
    on su.shift_id = s.id and su.status <> 'cancelled'
  where membership.is_member() and s.ends_at > now()
  group by s.id;
$$;

revoke all on function programmes.shift_places() from public, anon;
grant execute on function programmes.shift_places() to authenticated, service_role;

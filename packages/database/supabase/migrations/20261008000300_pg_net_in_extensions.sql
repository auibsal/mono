-- The advisor flags pg_net installed in `public`. pg_net cannot change
-- schema in place, so it is reinstalled in `extensions`. Its functions stay
-- in the `net` schema, so private.call_api and the cron jobs are unchanged;
-- only requests in flight at that moment are lost (the outbox retries them).
drop extension if exists pg_net;
create extension pg_net with schema extensions;

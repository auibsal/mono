# Releases and migrations

How a change reaches auibsal.org, the Nexus and the database.

Every change goes through a pull request to `main`. Nothing is edited on production by hand: not the code, not the database.

1. **Open a pull request.** CI runs lint, types, unit tests, the unused-code check, the RTL and translation checks, builds every app, starts a local database with every migration and runs the Row Level Security tests, and runs the browser journeys with accessibility checks. CodeQL scans the code. Vercel builds a preview of each affected app.
2. **Merge when CI is green.** Vercel deploys each changed app to production. Apps a change does not touch are skipped.
3. **The database follows.** When CI passes on `main`, the **Migrate production database** workflow runs `supabase db push`. It applies only migrations production has not seen, in order, and stops at the first error.
4. **Check.** The workflow run is green, the Vercel deployments read Ready, and the BetterStack monitors stay up.

## Rules for database changes

- A schema change is a new file in `packages/database/supabase/migrations`. Never edit a migration that has reached production; add a new one.
- Every new table enables Row Level Security in the same migration, and every policy has a pgTAP test. CI fails a table without RLS.
- Regenerate the types (`bun run db:types`) and commit them; CI checks they match.
- Never paste SQL into the production database. If a migration fails, fix it with a new migration and merge again.

## If a release breaks something

1. **Roll back the app** in Vercel: open the project, pick the last good production deployment, and promote it. This takes seconds and touches no data.
2. **Fix forward** with a pull request. A database change is never rolled back by hand; a new migration undoes it.
3. If data was lost, see [Backups and restore](backups.md).

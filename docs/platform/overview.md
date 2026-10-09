# How the platform works

The three apps, the database, and the rules that keep members' data safe.

The platform is one repository, [auibsal/mono](https://github.com/auibsal/mono), deployed to Vercel and backed by one Supabase project. Members never need to know any of this; the technical administrator and their successor do.

| App | Address | What it does |
| --- | --- | --- |
| Public site | [auibsal.org](https://auibsal.org) (`apps/web`) | Events, news, the Journal, documents, the Warmth Meter; English and Arabic |
| The Nexus | [nexus.auibsal.org](https://nexus.auibsal.org) (`apps/app`) | The member portal and the role-gated admin; a static site with no secrets |
| API | api.auibsal.org (`apps/api`) | Email, scheduled jobs, calendar feeds, file links, exports, account deletion; the only app holding the secret key |
| SAL Design System | design.auibsal.org (`apps/storybook`) | Every component, screen and email, in both languages; officers only, through Nexus sign-in |
| Officer handbook | nexus.auibsal.org/handbook | How to run the Society in the Nexus; officers only, edited in place |
| These runbooks | `docs/platform` in the repository | How the platform runs, for the technical administrator |

## How a request flows

1. The **public site** reads published rows from Postgres with the public (publishable) key, and caches pages until something is published.
2. The **Nexus** talks to Postgres directly with the signed-in member's own token. The database decides what that member may read or write.
3. When something needs a secret (sending email, a private file link, an export), the Nexus calls the **API** with the member's token; the API checks the member's permission again before acting.
4. Changes that need side effects (an email to send, a page to refresh) are written to an **outbox** table in the same transaction. The database hands each row to the API, which sends the email through Resend or refreshes the public site.

## The rules that keep it safe

- **Row Level Security is the boundary.** Every table checks `access.has_permission()` on every read and write. A screen the Nexus hides is a convenience; the database is the guard.
- **Permissions, not role names.** Roles are bundles of permissions, assigned only through `access.assign_role()`, never from a user's profile.
- **Two-step sign-in for sensitive roles.** Council officers, directors and the Elections Committee only hold their permissions on a session that passed the second step.
- **Secrets live only in the API and CI.** The Nexus bundle is public by design; CI fails if a secret's name or value appears in it.
- **Multi-step rules are database functions.** Ballots, the ranked-choice count, ledger sign-off, waitlist promotion and Journal decisions are single atomic functions.
- **Blind review.** Readers never receive an author's identity before a decision; the database withholds it.
- **The charity ledger is append-only.** Corrections are reversing entries; only signed-off entries count.

## Scheduled jobs

| Job | Runs | Does |
| --- | --- | --- |
| sal-outbox-drain | Every 10 minutes | Retries any outbox row the webhook missed |
| sal-publish | Every 10 minutes | Publishes scheduled news, issues and pieces |
| sal-calendar-sync | Hourly at :07 | Refreshes the AUIB campus calendar |
| sal-daily | 4:45 UTC (7:45 AM Baghdad) | Event reminders, agreement reminders, role-ending notices and overdue removal requests |
| sal-ballot-retention | 5:15 UTC | Deletes ballots and voter lists one year after an election closes (B6.11) |
| sal-outbox-prune | 5:30 UTC | Deletes sent outbox rows older than 30 days |
| keep-alive (Vercel Cron) | 1:00 UTC | Touches the database daily so the free Supabase project is never paused |
| Nightly backup (GitHub Actions) | 23:20 UTC | Encrypted dump of the production database, kept 30 days |

The first six run inside Postgres (pg_cron). The full design, data model and setup steps are in [ARCHITECTURE_AND_INTEGRATIONS.md](https://github.com/auibsal/mono/blob/main/ARCHITECTURE_AND_INTEGRATIONS.md); the rules for changing code are in [AGENTS.md](https://github.com/auibsal/mono/blob/main/AGENTS.md).

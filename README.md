# AUIB Society of Arts and Letters — platform

The web platform of the AUIB Society of Arts and Letters (SAL, «جمعية الفنون
والآداب»), the bilingual student society for literature, theater and the arts
at the American University of Iraq – Baghdad. *The paper and the pen.*

| App | What it is | Deployed at |
| --- | --- | --- |
| `apps/web` | Public site, `/en` and `/ar` | auibsal.org |
| `apps/app` | **The Nexus**: member portal and role-gated admin (static export) | nexus.auibsal.org |
| `apps/api` | Email, cron, calendar feeds, revalidation, exports, deletion | api.auibsal.org |
| `apps/docs` | SAL Docs: the Society's documents, the officer handbook, platform runbooks (Mintlify) | docs.auibsal.org |
| `apps/storybook` | SAL components, v5 Screens and every platform email (bilingual) | sal-storybook (Vercel login) |
| `apps/e2e` | Playwright + axe journeys | CI |

Data lives in Supabase (Postgres with Row Level Security on every table,
Auth, Storage). Hosting is Vercel.

## Getting started

Prerequisites: Node.js 24 (`.nvmrc`), [Bun](https://bun.sh), Docker (for the local
Supabase stack).

```sh
bun install
bun run db:start      # local Supabase: migrations + reference data
bun run dev           # every app: app :3000, web :3001, api :3002
```

Copy each app's `.env.example` to `.env.local` and fill in the local keys from
`bunx supabase status` (run in `packages/database`).

## Checks

```sh
bun run check         # Biome
bun run typecheck
bun run test
bun run db:test       # pgTAP: RLS and RPC behavior
bun run check:placeholders && bun run check:rtl && bun run check:i18n
```

## Further reading

- `PROGRESS.md` — the build checklist, decisions, blocked items, content still
  needed and Arabic awaiting native review
- `AGENTS.md` — rules for humans and AI agents
- `ARCHITECTURE_AND_INTEGRATIONS.md` — how the pieces fit together and how to
  set up Supabase, Vercel, Resend and the domains
- `.github/CONTRIBUTING.md` — workflow and local checks

Repository: https://github.com/auibsal/mono · Contact: hello@auibsal.org

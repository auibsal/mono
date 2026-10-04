# Agent and contributor guide

Conventions for anyone — human or AI agent — changing this repository.

## Repository map

- `apps/web` — marketing site (Next.js, i18n routes under `app/[locale]`).
- `apps/app` — the product, client-first: the same code runs in the browser
  and, as a static export (`bun run build:native`), inside the Capacitor
  iOS/Android apps. No Server Actions, Route Handlers, `cookies()`, proxy or
  request-time server rendering here; anything that needs a secret goes in
  `apps/api`, called with the user's token (`callApi` in `apps/app/lib/api.ts`).
- `apps/api` — webhooks, cron jobs and privileged server endpoints.
- `apps/email`, `apps/docs`, `apps/storybook` — templates, docs, UI workbench.
- `packages/*` — shared code, imported as `@repo/<name>`. `@repo` is a fixed
  internal scope; never rename it per project.
- `packages/config/project.json` — the single source of truth for organization,
  project, locales, region and commerce settings. Read it through `@repo/config`.
- `scripts/` — `init.ts` creates a project from the template (template only);
  `check-placeholders.ts`, `check-rtl.ts` and `check-i18n.ts` are repo checks.
- `ARCHITECTURE_AND_INTEGRATIONS.md` — how the pieces fit together and how to
  set up each integration (Supabase, Capacitor, tracking, Wayl, Vercel).

## Commands

```sh
bun install
bun run dev                 # all apps
bun run check | fix         # Biome (Ultracite rules)
bun run typecheck           # every workspace
bun run test                # Vitest in every workspace
bun run check:placeholders
bun run check:rtl           # physical Tailwind utilities (--fix rewrites them)
bun run check:i18n          # UI text that isn't in the messages files
bun run build:native        # static export of apps/app for Capacitor
bun run cap:sync            # build:native + copy into the iOS/Android projects
bun run gen:package         # scaffold packages/<name>
```

Run `check`, `typecheck` and `test` before every commit.

## Rules

- **Package manager:** Bun with the hoisted linker (`bunfig.toml`). Declare every
  dependency a package imports; keep versions aligned across workspaces. Bun
  installs and runs scripts; Next.js runs on Node (`next build`, not
  `bun --bun next build`).
- **Auth:** never authorize with `user_metadata` — users can edit it. In
  `apps/app`, query with `useAuth().supabase` (the browser or native client) so
  Row Level Security applies; gates like `RequireAuth` are only UX. In
  `apps/api`, identify callers with `authenticateRequest` (Bearer token) and
  check their membership/role. The admin client (`@repo/database/admin`)
  bypasses RLS and is only for webhooks, cron jobs and other trusted server
  code. `@repo/auth/server` is for server-rendered apps only.
- **Database:** schema changes are migrations with RLS policies and tests.
- **Secrets:** never in client code, logs or commits. New env vars go in the
  package's `keys.ts` and every affected `.env.example`.
- **Files:** use `@repo/storage`. Organization files live under
  `<organization id>/` and avatars under `<user id>/`; the bucket policies
  depend on that layout.
- **Analytics:** record events with `track()` from `@repo/analytics/client` — one
  event catalogue mapped to GA4, Meta and TikTok — instead of calling `gtag`,
  `fbq` or `ttq` directly. Server-confirmed purchases go through
  `@repo/analytics/conversions` with the same event id. Ad pixels never load
  inside the Capacitor apps.
- **Payments:** in-app (native) checkout is controlled by
  `project.commerce.allowNativeCheckout`. Digital goods must not be sold
  through third-party checkout inside the iOS/Android apps.
- **Translations:** every UI string comes from
  `packages/internationalization/messages/{ar,en}.json` (`useTranslations` /
  `getTranslations`), checked by `bun run check:i18n`. Pass numbers and dates
  into messages already formatted with `@repo/internationalization/format`
  (Latin digits, Baghdad time); ICU `#`/`{n, number}` would use Arabic-Indic
  digits. Link with `Link`/`useRouter` from
  `@repo/internationalization/navigation` so URLs keep their `/ar` or `/en`.
- **Localization:** UI must work in Arabic (RTL) and English (LTR). Use logical
  Tailwind utilities (`ms-*`, `pe-*`, `start-*`, `text-start`), never physical
  ones (`ml-*`, `pr-*`, `left-*`, `text-left`); `bun run check:rtl` enforces
  this. Icons that point along the reading direction (arrows, chevrons) get
  `rtl:rotate-180`. Dates default to `Asia/Baghdad`.
- **Optional modules:** code that belongs to an optional module (see
  `scripts/template/modules.ts`) is wrapped in `// <module:id>` …
  `// </module:id>` markers (`{/* … */}` in JSX, `#` in env files). Keep markers
  balanced; `bun run check:placeholders` verifies them.
- **Placeholders:** project-specific values use double-brace tokens such as the
  project name token in `README.md`. Only `bun run init` should replace them.
- **shadcn/ui:** files in `packages/design-system/components/ui` are generated;
  update them with the shadcn CLI rather than hand-editing where possible.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# SAL platform — progress

Working log for the AUIB Society of Arts and Letters platform (auibsal.org).
Every session starts here and continues from the first unticked item. The
brief is `sal-platform-claude-code-prompt.md` (uploaded at the start of the
first session); section numbers (§) refer to it.

Branch: `claude/new-session-qosn60`.

## Blocked — needed from the user

These stop parts of the work. Everything else continues around them.

- [x] **`brand/`** (2026-10-05): the v4 design-system export (BRAND-BOOK.md
      from its README, tokens.json/css, Ubuntu Arabic, components, the 13 logo
      SVGs, the retired Key for reference) and the v4 guide PDF
      (SAL-BRD-01, Version 4 · Draft 2).
- [x] **`docs-source/`** (2026-10-05): the six public founding documents
      (SAL-GOV-01, GOV-02, GOV-03, POL-01, STR-01, MEM-01). The repo is
      public, so the restricted ones are **not** committed: the Founding
      Proposal (Council only), Operations Playbook, Templates & Forms,
      Printables and the Operations Tracker go to the private `library`
      bucket through the Nexus library. **Still missing:** the Journal
      Submission Guidelines, Editorial Rubric, Masthead Handbook,
      Publication Agreement, Issue Playbook, the Charity (Second Chapter)
      Playbook and Operations Kit, and the Side Quest care rules — unless
      they are sections of the documents above (to check while converting).
- [x] Founder bootstrapped (global `president`, 2026-10-04).
- [x] Supabase project `auibsal.org` (`fghzahtzgelqnpwdhwjo`, eu-central-1):
      migrations applied, SAL schemas exposed, Auth site and redirect URLs
      set, email sign-up only.
- [x] Vercel team `theideaiq`: sal-web (auibsal.org, www), sal-nexus
      (nexus.auibsal.org), sal-api (api.auibsal.org), functions in fra1.
- [x] Resend set up by the owner (2026-10-05); verify RESEND_* on sal-api and
      Supabase SMTP with a real sign-up.
- [x] sal-web holds only public values and `REVALIDATE_SECRET` (checked
      2026-10-07); the server secrets the integration copied are gone.
- [x] Semesters (owner, 2026-10-06): Fall 2026 Sep 6 – Dec 17, 2026; Spring
      2027 Jan 24 – May 13, 2027, entered in production. Exam weeks: still
      to come.
- [ ] **Supabase Auth email (dashboard only):** Authentication → SMTP:
      `smtp.resend.com`, port 465, user `resend`, password a Resend API key
      (sending access, auibsal.org), sender `hello@auibsal.org`, name "AUIB
      Society of Arts and Letters". Authentication → Email Templates: paste
      the four files in `packages/database/supabase/templates` with the
      subjects in `subjects.txt`. (Local stacks load them from `config.toml`.)
      Since 2026-10-08 the links go to `{{ .SiteURL }}/en/auth/confirm`, so
      the Site URL must be `https://nexus.auibsal.org`.
- [x] **Liveblocks secret** set on sal-api by the owner (2026-10-08).
- [x] **Knock and Upstash removed** (owner, 2026-10-08): packages, env keys
      and CSP hosts are gone. Delete the two accounts at will.
- [x] **Migrations through CI:** the owner added `SUPABASE_ACCESS_TOKEN` and
      `SUPABASE_DB_PASSWORD` to the GitHub `production` environment
      (2026-10-08); `migrate.yml` applied 20261008000200–0700 the same day.
      Council members, the Treasurer and the Elections Committee enroll an
      authenticator app the next time they open Administration.
- [ ] **HSTS preload:** the header now carries `preload`; submit
      auibsal.org at hstspreload.org once the deploy is live.
- [ ] **Supabase Auth → MFA:** confirm TOTP is enabled (on by default).
- [ ] **Owner dashboard steps** listed in the Master Configuration Guide
      (claude.ai artifact TRFXS3611Y1PRNHy5yT7En): `SENTRY_AUTH_TOKEN` on the
      three Vercel projects, Cloudflare Email Routing for `hello@auibsal.org`
      (no MX record today, so replies bounce), Vercel Bot Protection on
      sal-web in Log mode.
- [x] Cancelled by the owner (2026-10-08): leaked-password protection (a
      paid Supabase feature; everything stays on free plans) and the AUIB IT
      allowlist (mail already reaches AUIB inboxes).
- [x] AUIB calendar: `https://auib.edu.iq/events/list/?ical=1`. Cloudflare
      answers this sandbox with a bot challenge (403); test from the cron.
- [x] Cost per winter set: not final; the UI uses the 40,000 IQD placeholder
      setting (`charity.cost_per_set_iqd`), marked as a placeholder.
- [x] `docs.auibsal.org`: public, `noindex` (decision below).
- [x] GA4: later; the code stays behind `NEXT_PUBLIC_GA_ID`.
- [x] Collaboration is back in scope (owner, 2026-10-05): Liveblocks, with
      the secret key in apps/api only (decision below).

## Decisions

- **American English** (owner, 2026-10-08) for all copy, comments, commits
  and docs; verbatim quotes from the Society's documents keep their spelling.
- **v5 Screens** (owner, 2026-10-08, Option B of the audit): square corners,
  a 2px frame, one solid offset elevation, tracked capitals only for
  kickers, navigation and buttons (never Arabic), the Nexus on ink. Print is
  unchanged. Recorded in `brand/BRAND-BOOK.md` ("Screens") and the Design
  System artifact.
- **Monitoring and protection on free plans** (2026-10-08): Sentry (projects
  sal-web, sal-nexus, sal-api; 10% traces, no replays), BetterStack uptime
  (three monitors), Arcjet on apps/api's public form endpoints only (fails
  open; not on page views).

- **Public repository:** auibsal/mono is public, so `docs-source/` holds
  only documents the brief lists as public. Restricted documents live in the
  private `library` bucket, reached through signed URLs.
- **docs.auibsal.org is public with `noindex`.** It holds the developer
  handbook and the admin guide; nothing in it is secret (RLS is the boundary,
  not obscurity), and Council members need it without Vercel accounts.
- **Tokens come from `brand/tokens.json`** (generator + tests). Two platform
  additions, both existing tones: the `rule` role (light `rule`, ink
  `ink-70`) and captions on crimson-50/paper switch to `ink-70`, as the
  brand's contrast table requires.

- `bun run init` kept notifications, feature-flags and rate-limit; removed
  cms (BaseHub, not Supabase-backed), collaboration, webhooks and ai.
  `payments`, Capacitor targets, phone OTP and the SMS hook removed by hand.
- The template's tenancy and billing schema was replaced outright (no SAL
  database exists yet, so nothing was dropped from a shared database).
- All SAL schemas are exposed to the Data API; private helpers live in the
  unexposed `private` schema. Production must add the schemas under
  Settings → API (documented in ARCHITECTURE_AND_INTEGRATIONS.md).
- Spending limits are data (`access.roles.spending_limit_iqd`: Director
  50,000, President 250,000), so SQL checks permissions, not role names.
  Above the highest limit an adopted Council resolution is required and the
  Treasurer records it.
- The Advisory Board has its own permission (`journal.advise`) so readers
  (`journal.review`) never see flagged entries by default.
- Blind entries copy title and text at "in review"; the submission ↔ blind id
  mapping (`journal.blind_keys`) is readable only by `journal.identity.view`.
- Elections: RON is offered only on uncontested races (as the brief says);
  ties for last place are broken by fewer first preferences, then by id
  (recorded in the rounds). **Check against the Elections Code (B-series)
  when the Bylaws arrive.** The founder's pre-election presidency
  (`note = 'founder-pre-election'`) does not count towards the two-term limit.
- Feature flags are rows in `core.settings` (`features.*`), not PostHog:
  the Nexus is static and the database must enforce `features.elections`.
- Analytics: GA4 only (`NEXT_PUBLIC_GA_ID`), on apps/web only; Meta, TikTok,
  PostHog, GTM, Vercel Analytics and server conversions removed.
- The Nexus is always a static export; its security headers are in
  `apps/app/vercel.json`. Routes with ids use query strings (static export).
- Members-only piece text lives in `journal.piece_bodies`, so piece metadata
  can be public (with a sign-in prompt) while the text stays members-only.
- Side effects (emails, revalidation) are queued in `core.outbox` inside the
  transaction; an insert trigger hands each to apps/api (pg_net), and a
  drain every ten minutes retries what failed.

## Checklist

### Foundation (§3)
- [x] `bun run init`; remove payments, Wayl, commerce config, Capacitor, native auth
- [x] Email auth: password + magic link + reset, AUIB auto-verify, other domains → queue
- [x] Phone OTP off (config.toml), SMS hook removed
- [x] Analytics: GA4 on web only behind `NEXT_PUBLIC_GA_ID`
- [x] `project.json` filled (names, motto, hosts, locales, region, journal defaults)
- [x] Shared session cookie (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.auibsal.org`)
- [x] `@repo/rbac` (with drift test against the SQL seed)
- [x] `@repo/sal-data` (schemas tested against SQL constraints)
- [x] AGENTS.md / README / ARCHITECTURE_AND_INTEGRATIONS.md rewritten for SAL
- [x] check-placeholders clean
- [x] Supabase Auth email templates (bilingual, branded) in `supabase/templates` (production: dashboard, see Blocked)

### Design system (§4)
- [x] Tokens → CSS variables, generated from `brand/tokens.json` (tests: palette, contrast, staleness)
- [x] shadcn variables aliased to role tokens; ink theme via `data-theme="dark"`
- [x] No shadows (theme-level), 8px card radius, hairline/band utilities (print; screens: v5 below)
- [x] v5 Screens: `frame` and `offset` roles, `radius-screen` 0, `shadow-offset` (mirrors in RTL, `press` collapses it), `type-label`, Arabic never tracked; buttons and form controls restyled; light islands inside ink
- [x] v5 Screens: public header (five sections, sticky), home, ink footer; Nexus shell on ink; auth on a light sheet
- [ ] v5 Screens: remaining public pages (events list, the Journal, about, join) and admin screens get the framed cards
- [x] Ubuntu / Ubuntu Mono / Amiri / Literata via next/font/google
- [x] Ubuntu Arabic via next/font/local (byte-checked against brand/fonts)
- [x] Type styles from the brand (Display 1.02, Lede 300/1.3, Body 1.5, Caption 1.4, Kicker 0.06em); `:lang(ar)` one step larger, 1.8–2.0 leading, 1.4 at display
- [x] Logos in web/app public/brand (byte-checked), favicon = sal-avatar.svg
- [x] Open Graph images (apps/web `/[locale]/og`; Arabic laid out word by word, since Satori has no bidi)
- [x] Storybook: light/ink themes and an LTR/RTL toolbar; SAL stories
- [ ] Re-theme pass over every shadcn story in both directions (visual check)
- [x] FormHeader, DocumentHeader, DocumentFooter, SocialPost ported from brand/components; SalCard
- [x] Copy formats: `formatLongDate`, `formatClock`, `formatIqd` (tested)
- [x] Skip link, visible focus, reduced motion, functional icons only so far

### Database (§5)
- [x] `core`, `access` (has_permission, assign_role, end_role_assignment, my_permissions)
- [x] `membership` (tiers, versioned pledges, verification queue, activity, voting, calendar tokens)
- [x] `events` (RSVP, capacity, waitlist promotion, check-in → activity, staff, campus cache)
- [x] `journal` (2 per call, 3 per hour, rubric v2, third read, transitions, decisions, reveal, agreements)
- [x] `charity` (append-only ledger, two counters, second-person sign-off, counted totals, Warmth Meter)
- [x] `programmes` (episodes, reels, Six Words, rotas/shifts, removal requests with 24-hour clock)
- [x] `governance` (minutes, resolutions, spending thresholds, library, elections, ranked-choice count)
- [x] `content` (pages, news, media, homepage slots, announcements, document index, published-only search)
- [x] Activity-log triggers (never on ballots or receipts)
- [x] Storage buckets + policies; revalidation and scheduled-publish functions
- [x] Reference data: permissions, roles, bundles, programs, settings
- [x] pgTAP: 176 assertions in 8 files; CI fails on a table without RLS
- [x] Generated types (CI diffs them)
- [ ] pgTAP coverage for the remaining policies one by one (content admin writes, governance minutes, library)
- [ ] Seed production data (semesters, settings) — **blocked on dates/URLs**

### Nexus — member (§7)
- [x] Sign-in (password or magic link), sign-up (return URL), forgot/reset, callback
- [x] Verification-pending screen for non-AUIB accounts
- [x] `/setup`: both pledges (versioned, re-accept on change), language, notifications, camera-shy, personal email
- [x] Home: membership card + QR, next events + ticket QR + cancel + .ics, voting eligibility, notices, the Journal call countdown + my submissions, programs, calendar feed (copy/reset), Six Words
- [x] Profile and privacy, account deletion through apps/api
- [x] Events page: browse, book with registration questions, places left, waitlist join/leave, give a place back (tickets stay on Home); the public RSVP button links to the event's card
- [ ] Past attendance on the Events page
- [x] Journal: submit (rich text or files, translation fields, Human Authorship reconfirmed each time), my submissions, revise when returned, withdraw, sign the Publication Agreement (text is `TODO(content)`)
- [x] Programs: rotas with upcoming shifts, places left (`programmes.shift_places`), sign up, give back
- [ ] Society (Book of Members, roster, minutes, elections)

### Nexus — admin (§8)
- [x] Shell and module gating by permission (UX only; RLS and RPCs enforce)
- [x] Overview (`core.admin_overview()`), Members (directory, verification queue, tiers, manual activity, roles via `access.assign_role`)
- [x] Events (editor, questions, attendance, camera QR check-in)
- [x] Content (news, pages, announcements, homepage slots, media library; Liveblocks co-editing when enabled)
- [x] Charity (campaigns, ledger with sign-off and reversals, receipts through signed URLs; winter-set cost is a placeholder setting)
- [x] Programs, Governance (minutes co-edited, elections, spending, library uploads), Activity log, Settings
- [x] Journal issues, pieces, contributors; accepted work becomes a draft piece; publishing blocked until the agreement is signed
- [x] Journal pipeline (`/admin/pipeline`): per-issue tabs by role — my reading (rubric v2 scoring), intake (return for formatting, send to blind review, originals via `/files/submission`), reader assignment, drag-and-drop board with a keyboard Move menu, selection by average and band, decisions with author reveal, Advisory Board flagged view, calls
- [x] Blind copies: `/files/blind` strips PDF info/XMP/annotation authors, image EXIF, DOCX properties and revision authors; never falls back to the original
- [x] CSV exports through apps/api (members, attendance, ledger, spending)
- [x] Migrations `20261005000000_admin`, `…0100_waraq_publishing` and `…0200_waraq_pipeline` applied to production (2026-10-06)

### Public site (§6)
- [x] Layout (skip link, header, footer, language switch), home (events, the Journal, Warmth Meter, calls, join band), 404
- [x] Revalidation route (cache tags), sitemap (existing pages only, hreflang), robots
- [x] Documents: registry (`packages/sal-data/documents.json`, one entry per docs-source PDF, status shown on every page; all six are Draft 1 for ratification on Charter Day), index and per-document pages with contents, PDFs published at build (`apps/web/scripts/copy-documents.mjs`). The documents are English-only; `/ar` says so.
- [x] Events: upcoming and past lists, detail (canceled notice, sanitized body, image, RSVP in the Nexus, add-to-calendar .ics), calendar subscription (webcal)
- [x] Journal: hub (open calls → submit in the Nexus, issues, latest), issue, piece and contributor pages; members-only text stays in the Nexus (`/journal/piece?slug=`)
- [x] About (Constitution preamble, motto, mission and "At a Glance", marked as quoted from the draft; Handbook pillars), Programs (Handbook summaries, migration `20261006000000`), Join (Handbook steps and membership table; the Arabic is the Handbook's own welcome page where it exists)
- [x] Give + transparency (Warmth Meter from signed-off money only, public receipts, impact, P7.5), News (list, post), Contact (channels, concerns), Media kit (name rules, logos as supplied, palette), Privacy (P5 and P6 verbatim, platform facts), Side Quest care + removal form (`apps/api /removal-requests`, rate-limited, honeypot), Search (published rows + document registry), drawn share images (`/[locale]/og`, default for every page)
- [ ] Structured data (JSON-LD)

### API (§11)
- [x] Account deletion; keep-alive cron; iCal: member feed, per-event, public feed
- [x] `/hooks/outbox`: emails + revalidation. An insert trigger calls it via
      pg_net (bearer from Vault); a drain every 10 minutes retries, up to 5
      attempts, recording `last_error`
- [x] Email templates (bilingual, recipient's language first; `@repo/email`
      `Notice` + `copy.ts`) and Resend sending
- [x] Cron (pg_cron): hourly AUIB calendar sync → `core.external_events`;
      daily 7:45 AM Baghdad reminders, agreement reminders, role-expiry
      notices, overdue removal requests; scheduled publishing every 10 minutes
      (a piece without a signed agreement no longer blocks the others)
- [ ] Signed URLs (blind copies with metadata stripped, receipts), CSV exports, removal-request + contact endpoints with rate limits

### Infrastructure (§12)
- [x] Supabase project, migrations, buckets, exposed schemas, Auth URLs, FK indexes
- [ ] Supabase SMTP (Resend, dashboard); [x] outbox trigger and Vault secrets; 52 "multiple permissive policies" advisor warnings (deferred)
- [x] Vercel projects, env vars, domains, cron, previews
- [x] CI: lint, typecheck, unit, repo checks, tokens check, pgTAP, type diff, integration, builds, client-bundle secret scan
- [ ] CI: Playwright e2e against previews; migrations on merge to `main`

### Acceptance tests (§13)
Covered by automated tests so far:
- [x] No self-promotion by metadata, direct writes or RPCs (pgTAP 10_access)
- [x] Reader's API responses carry no author identity before a decision (sal-data integration)
- [x] No submission or receipt file without a signed URL (storage integration)
- [x] Every table has RLS (pgTAP 00_structure)
- [x] Members-only events hidden from visitors and search (pgTAP 30_events); public feeds filter them (apps/api)
- [x] Ballots unreadable by any client role; one ballot per voter (pgTAP 60_governance)
- [x] Ledger not editable or deletable; unsigned entries excluded (pgTAP 50_charity)
- [x] All categories accepted; third submission rejected (pgTAP 40_journal)
- [x] Rubric limits identical in zod, form and DB; spread > 20 → third read (sal-data + pgTAP)
- [x] Voting eligibility boundary (pgTAP 20_membership)
- [x] Waitlist promotion on cancel (pgTAP 30_events)
- [x] Spending approvals reject over-threshold pairs (pgTAP 60_governance)
- [x] Assignments stop at `ends_at` (pgTAP 10_access)
- [ ] Sitemap lists only existing pages with alternates (e2e)
- [ ] Every page renders in /ar and /en (e2e); check-rtl and check-i18n pass ✓ so far
- [x] Document pages show correct status (registry test: every docs-source PDF registered; none marked adopted before ratification)
- [ ] Emails arrive bilingual and on brand (needs Resend)
- [ ] Secrets absent from builds — CI scan in place; verify on production builds

## Content still needed

- The Journal, Second Chapter and Side Quest documents listed above.
- A formal Human Authorship pledge wording: the setup page shows Policy
  Manual P10.1 (English verbatim) until one exists. The Member Pledge is now
  the SAL-POL-01 text verbatim (the manual itself flags its Arabic for a
  native check).
- The Publication Agreement in the Nexus quotes Policy Manual P9.1, P9.2, P9.5
  and P10.1 (no separate agreement exists in the documents); its last line,
  naming the purpose agreed (the Journal online and in print, and the archive), was
  written for the platform — confirm it.
- The Common Room's Telegram link and the Faculty Advisor's name (both
  bilingual where relevant): Nexus → Administration → Settings → Society
  contacts. The Society email is set to `hello@auibsal.org`.
- Founders' Roll names: Content → pages → `about/founders`.
- The care promise for Side Quest beyond Policy Manual 5.3. (Program descriptions now come from the Member Handbook.)
- Traditions (Charter Night, the Ribbon, the Term Card) text: Content → pages → `about/traditions`.
- The first Second Chapter campaign (`second-chapter-2026`, draft, November 1–11): target and cost per set.
- Confirmed cost per winter set.

## needs-native-review (Arabic written for the platform)

- `packages/internationalization/messages/ar.json` — every string (all of it
  was written for the platform; none came from a source document), except
  the motto «والقرطاسُ والقلم» and the Society's name «جمعية الفنون والآداب»,
  which come from the brief.
- `access.roles.name_ar` (reference-data migration): all 24 role names.
- `core.programmes.name_ar`: every name.
- `charity.campaigns.unit_label_ar` default «أطفال كُسوا».
- `core.semesters` names in pgTAP fixtures are test-only (no review needed).
- The transliteration «النِّكسَس» for "the Nexus".
- Arabic document titles in `packages/sal-data/documents.json` (except «دليل السياسات»).
- `core.programmes.summary_ar` (migration `20261006000000`) and «ليلة المناظرة» for Motion Night (was «ليلة الصورة المتحركة», which meant a moving-image night).
- `web.about` Arabic (translated from the Constitution and Handbook) and the parts of `web.join` that are not on the Handbook's Arabic welcome page.
- The Arabic of Policy Manual P10.1 on the setup page (translated for the
  platform; the manual has no Arabic for it) and the Arabic program names
  for "the Prizes" in it (the other program names match the reference data).
- Email Arabic: every Arabic string in `packages/email/copy.ts` and the
  Arabic halves of `packages/database/supabase/templates/*.html` and
  `subjects.txt`.
- Sign-in links (2026-10-08): «جارٍ الإرسال…» and the new `auth.callback.failed` text.
- Auth email links (2026-10-08): `auth.confirm.*` and the new Arabic in
  `supabase/templates/magic_link.html` («رابط دخولك», «افتح النِّكسَس»).

- AUIB Literary Journal (2026-10-08): «مجلة AUIB الأدبية» and every Arabic
  string added that day (`nexus.society.*`, `nexus.next.*`, the two-step
  panel, setup progress and pledge reasons, the reading timeline, overview
  context sentences, Society contacts settings).

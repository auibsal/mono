# SAL platform — progress

Working log for the AUIB Society of Arts and Letters platform (auibsal.org).
Every session starts here and continues from the first unticked item. The
brief is `sal-platform-claude-code-prompt.md` (uploaded at the start of the
first session); section numbers (§) refer to it.

Branch: `claude/new-session-qosn60`.

## Blocked — needed from the user

These stop parts of the work. Everything else continues around them.

- [ ] **`brand/` is not in the repo** (BRAND-BOOK.md, tokens.json, Ubuntu
      Arabic fonts, components HTML + bundle.css, 13 logo SVGs). Until it
      arrives: tokens are transcribed from the §4 palette
      (`packages/design-system/tokens/sal.tokens.json`, marked INTERIM), the
      ink-theme role mapping and type sizes are my interim choices, Ubuntu
      Arabic falls back to the system font (never a substitute face), and
      `BrandLogo` prints the Society's name (logos are never redrawn).
- [ ] **`docs-source/` is not in the repo.** Every document in §6 needs its
      source PDF/DOCX; pages will be built with structure and `TODO(content)`.
- [ ] Shaheen Farjo's sign-in email (first admin: `access.bootstrap_founder`).
- [ ] **Supabase:** the connected account has only `theideaiq.com`, no SAL
      project. Need the SAL project ref and access (or permission to create
      one in that organization).
- [ ] **Vercel:** the connected team (`theideaiq`) does not hold
      `auibsal.org`. Need the team that owns the domain, or the domain added
      to this team.
- [ ] Resend API key (or account); from address (default
      `SAL <hello@auibsal.org>`) and a reply-to.
- [ ] Fall 2026 and Spring 2027 semester dates; exam weeks.
- [ ] AUIB public calendar iCal URL.
- [ ] Natrok Athar's cost per winter set (40,000 IQD placeholder).
- [ ] `docs.auibsal.org`: public or protected?
- [ ] GA4 measurement ID (optional).

## Decisions

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
  transaction; one database webhook hands them to apps/api.

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
- [ ] Supabase Auth email templates (bilingual, branded) in `supabase/templates`

### Design system (§4)
- [x] Tokens → CSS variables (generator + test; INTERIM source until tokens.json)
- [x] shadcn variables aliased to role tokens; ink theme via `data-theme="dark"`
- [x] No shadows (theme-level), 8px card radius, hairline/band utilities
- [x] Ubuntu / Ubuntu Mono / Amiri / Literata via next/font/google
- [ ] Ubuntu Arabic via next/font/local (**blocked: brand/fonts**)
- [x] Type styles (INTERIM sizes): display, lede, heading, subheading, body, caption, kicker, code; `:lang(ar)` one step larger, 1.9 leading
- [ ] Logos into web/app public, favicon/app icon/OG (**blocked: brand/logos**)
- [x] Storybook: light/ink themes and an LTR/RTL toolbar; SAL stories
- [ ] Re-theme pass over every shadcn story in both directions (visual check)
- [x] FormHeader, DocumentHeader, DocumentFooter, SalCard (INTERIM layouts)
- [ ] SocialPost + Open Graph images (**needs brand/components**)
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
- [x] Reference data: permissions, roles, bundles, programmes, settings, Natrok Athar
- [x] pgTAP: 176 assertions in 8 files; CI fails on a table without RLS
- [x] Generated types (CI diffs them)
- [ ] pgTAP coverage for the remaining policies one by one (content admin writes, governance minutes, library)
- [ ] Seed production data (semesters, settings) — **blocked on dates/URLs**

### Nexus — member (§7)
- [x] Sign-in (password or magic link), sign-up (return URL), forgot/reset, callback
- [x] Verification-pending screen for non-AUIB accounts
- [x] `/setup`: both pledges (versioned, re-accept on change), language, notifications, camera-shy, personal email
- [x] Home: membership card + QR, next events + ticket QR + cancel + .ics, voting eligibility, notices, Waraq call countdown + my submissions, programmes, calendar feed (copy/reset), Six Words
- [x] Profile and privacy, account deletion through apps/api
- [ ] Events pages (browse, RSVP with questions, tickets, past attendance)
- [ ] Waraq: submit (Tiptap + uploads), my submissions, sign agreement
- [ ] Programmes (rotas, sign-ups); Society (Book of Members, roster, minutes, elections)

### Nexus — admin (§8)
- [ ] Overview, Members (queue, tiers, manual activity, roles), Events (+ QR check-in), Waraq issues/pieces, Pipeline board, Content, Charity, Programmes, Governance, Activity log, Settings
- [ ] CSV exports through apps/api

### Public site (§6)
- [x] Layout (skip link, header, footer, language switch), home (events, Waraq, Warmth Meter, calls, join band), 404
- [x] Revalidation route (cache tags), sitemap (existing pages only, hreflang), robots
- [ ] About, Programmes, Waraq hub/pieces/contributors, Events (list, calendar, detail, .ics), Give + transparency, Join, News, Documents (+ registry, MDX, status banners), Contact, Media kit, Privacy, Side Quest care + removal form, Search, structured data, OG images

### API (§11)
- [x] Account deletion; keep-alive cron; iCal: member feed, per-event, public feed
- [ ] `/hooks/outbox` (database webhook): emails + revalidation
- [ ] Email templates (bilingual) and Resend sending
- [ ] Cron: hourly AUIB calendar sync; daily reminders, agreement reminders, role-expiry notices, stale removal requests, scheduled publishing
- [ ] Signed URLs (blind copies with metadata stripped, receipts), CSV exports, removal-request + contact endpoints with rate limits

### Infrastructure (§12) — blocked on access
- [ ] Supabase project, migrations, buckets, Auth, SMTP, webhook, advisors
- [ ] Vercel projects, env vars, domains, cron, previews
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
- [ ] Document pages show correct status (registry test, once documents exist)
- [ ] Emails arrive bilingual and on brand (needs Resend)
- [ ] Secrets absent from builds — CI scan in place; verify on production builds

## Content still needed

- Every document source in §6 (`docs-source/` missing).
- Human Authorship pledge text and Member Pledge text (SAL-POL-01) —
  currently `TODO(content)` in the messages files.
- Founders' Roll names; the Faculty Advisor's name.
- Programme descriptions (all 12) and the care promise for Side Quest.
- Traditions (Charter Night, the Ribbon, the Term Card) text.
- Natrok Athar's description (both languages) and confirmed cost per winter set.

## needs-native-review (Arabic written for the platform)

- `packages/internationalization/messages/ar.json` — every string (all of it
  was written for the platform; none came from a source document), except
  the motto «والقرطاسُ والقلم», the Society's name «جمعية الفنون والآداب»,
  «ورق» and «نترك اثر», which come from the brief.
- `access.roles.name_ar` (reference-data migration): all 24 role names.
- `core.programmes.name_ar`: every name except «ورق».
- `charity.campaigns.unit_label_ar` default «أطفال كُسوا».
- `core.semesters` names in pgTAP fixtures are test-only (no review needed).
- The transliteration «النِّكسَس» for "the Nexus".

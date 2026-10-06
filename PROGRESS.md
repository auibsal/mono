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
      bucket through the Nexus library. **Still missing:** the Waraq
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
- [ ] **sal-web holds server secrets** copied by the Supabase integration
      (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `SUPABASE_JWT_SECRET`, `POSTGRES_*`). Delete them from the project.
- [ ] Fall 2026 and Spring 2027 semester dates; exam weeks. The owner points
      to the AUIB feed for them; it holds events, not term dates, so the
      dates still need entering in Settings → Semesters.
- [x] AUIB calendar: `https://auib.edu.iq/events/list/?ical=1`. Cloudflare
      answers this sandbox with a bot challenge (403); test from the cron.
- [x] Cost per winter set: not final; the UI uses the 40,000 IQD placeholder
      setting (`charity.cost_per_set_iqd`), marked as a placeholder.
- [x] `docs.auibsal.org`: public, `noindex` (decision below).
- [x] GA4: later; the code stays behind `NEXT_PUBLIC_GA_ID`.
- [x] Collaboration is back in scope (owner, 2026-10-05): Liveblocks, with
      the secret key in apps/api only (decision below).

## Decisions

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
- [x] Tokens → CSS variables, generated from `brand/tokens.json` (tests: palette, contrast, staleness)
- [x] shadcn variables aliased to role tokens; ink theme via `data-theme="dark"`
- [x] No shadows (theme-level), 8px card radius, hairline/band utilities
- [x] Ubuntu / Ubuntu Mono / Amiri / Literata via next/font/google
- [x] Ubuntu Arabic via next/font/local (byte-checked against brand/fonts)
- [x] Type styles from the brand (Display 1.02, Lede 300/1.3, Body 1.5, Caption 1.4, Kicker 0.06em); `:lang(ar)` one step larger, 1.8–2.0 leading, 1.4 at display
- [x] Logos in web/app public/brand (byte-checked), favicon = sal-avatar.svg
- [ ] Open Graph images from SocialPost (apps/web)
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
- [x] Waraq: submit (rich text or files, translation fields, Human Authorship reconfirmed each time), my submissions, revise when returned, withdraw, sign the Publication Agreement (text is `TODO(content)`)
- [ ] Programmes (rotas, sign-ups); Society (Book of Members, roster, minutes, elections)

### Nexus — admin (§8)
- [x] Shell and module gating by permission (UX only; RLS and RPCs enforce)
- [x] Overview (`core.admin_overview()`), Members (directory, verification queue, tiers, manual activity, roles via `access.assign_role`)
- [x] Events (editor, questions, attendance, camera QR check-in)
- [x] Content (news, pages, announcements, homepage slots, media library; Liveblocks co-editing when enabled)
- [x] Charity (campaigns, ledger with sign-off and reversals, receipts through signed URLs; winter-set cost is a placeholder setting)
- [x] Programmes, Governance (minutes co-edited, elections, spending, library uploads), Activity log, Settings
- [x] Waraq issues, pieces, contributors; accepted work becomes a draft piece; publishing blocked until the agreement is signed
- [x] Waraq pipeline (`/admin/pipeline`): per-issue tabs by role — my reading (rubric v2 scoring), intake (return for formatting, send to blind review, originals via `/files/submission`), reader assignment, drag-and-drop board with a keyboard Move menu, selection by average and band, decisions with author reveal, Advisory Board flagged view, calls
- [x] Blind copies: `/files/blind` strips PDF info/XMP/annotation authors, image EXIF, DOCX properties and revision authors; never falls back to the original
- [x] CSV exports through apps/api (members, attendance, ledger, spending)
- [x] Migrations `20261005000000_admin`, `…0100_waraq_publishing` and `…0200_waraq_pipeline` applied to production (2026-10-06)

### Public site (§6)
- [x] Layout (skip link, header, footer, language switch), home (events, Waraq, Warmth Meter, calls, join band), 404
- [x] Revalidation route (cache tags), sitemap (existing pages only, hreflang), robots
- [x] Documents: registry (`packages/sal-data/documents.json`, one entry per docs-source PDF, status shown on every page; all six are Draft 1 for ratification on Charter Day), index and per-document pages with contents, PDFs published at build (`apps/web/scripts/copy-documents.mjs`). The documents are English-only; `/ar` says so.
- [x] Events: upcoming and past lists, detail (cancelled notice, sanitised body, image, RSVP in the Nexus, add-to-calendar .ics), calendar subscription (webcal)
- [ ] About, Programmes, Waraq hub/pieces/contributors, Give + transparency, Join, News, Contact, Media kit, Privacy, Side Quest care + removal form, Search, structured data, OG images

### API (§11)
- [x] Account deletion; keep-alive cron; iCal: member feed, per-event, public feed
- [ ] `/hooks/outbox` (database webhook): emails + revalidation
- [ ] Email templates (bilingual) and Resend sending
- [ ] Cron: hourly AUIB calendar sync; daily reminders, agreement reminders, role-expiry notices, stale removal requests, scheduled publishing
- [ ] Signed URLs (blind copies with metadata stripped, receipts), CSV exports, removal-request + contact endpoints with rate limits

### Infrastructure (§12)
- [x] Supabase project, migrations, buckets, exposed schemas, Auth URLs, FK indexes
- [ ] Supabase SMTP (Resend), outbox webhook; 52 "multiple permissive policies" advisor warnings (deferred)
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

- The Waraq, Second Chapter and Side Quest documents listed above.
- A formal Human Authorship pledge wording: the setup page shows Policy
  Manual P10.1 (English verbatim) until one exists. The Member Pledge is now
  the SAL-POL-01 text verbatim (the manual itself flags its Arabic for a
  native check).
- The Publication Agreement text that authors sign in the Nexus
  (`TODO(content)` in `nexus.waraq.agreement.body`).
- Confirm the Member Handbook's status: its cover has no "Draft" label, but the registry lists it as a draft with the other founding documents.
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
- Arabic document titles in `packages/sal-data/documents.json` (except «دليل السياسات»).
- The Arabic of Policy Manual P10.1 on the setup page (translated for the
  platform; the manual has no Arabic for it) and the Arabic programme names
  for "the Prizes" in it (the other programme names match the reference data).

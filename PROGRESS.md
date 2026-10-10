# SAL platform — progress

Working log for the AUIB Society of Arts and Letters platform (auibsal.org).
Every session starts here and continues from the first unticked item. The
brief is `sal-platform-claude-code-prompt.md` (uploaded at the start of the
first session); section numbers (§) refer to it.

Branch: `claude/new-session-qosn60`.

## Blocked — needed from the user

- [ ] **Notion connection can read emails:** Notion → Settings → Connections →
  SAL Platform → Capabilities → allow "Read user information including email
  addresses". Without it the sync cannot tell who set Ready to publish, so it
  publishes nothing (`docs/platform/notion.md`).
- [ ] **Protect `main` (GitHub → Settings → Rules → New branch ruleset):** target
      `main`; require a pull request; require the checks "Lint, typecheck,
      test", "Build apps", "Database (migrations, RLS, integration)" and
      "End-to-end (Playwright + axe)"; block force pushes and deletion.
- [ ] **Email to hello@auibsal.org bounces (no MX record):** Cloudflare →
      auibsal.org → Email → Email Routing → enable, then route
      `hello@auibsal.org` to the inbox that should read it.
- [ ] **Turborepo remote cache for CI (optional, faster CI):** Vercel →
      Account Settings → Tokens → create one; GitHub → Settings → Secrets and
      variables → Actions: secret `TURBO_TOKEN`, variable `TURBO_TEAM` =
      `theideaiq`.
- [ ] **Zero-cost plans (owner, 2026-10-08):** nothing paid. Vercel moves
      back to Hobby when the owner chooses (Settings → Billing → Downgrade);
      everything else is already on a free plan. Resend Free sends 100 emails
      a day: the outbox now holds anything over the limit until it resets
      instead of dropping it.
- [ ] **Passkeys:** Supabase → Authentication → Passkeys: on; Relying Party
      ID `auibsal.org` (never change it after members register passkeys);
      origins `https://nexus.auibsal.org`; display name `AUIB Society of
      Arts and Letters`. The Nexus shows the passkey button and the Profile
      card already; see `docs/platform/accounts.md`.
- [ ] **Partnerships (P11):** in Administration → Members, give the
      Director of Partnerships & Outreach role to whoever holds it (the VP
      covers it while vacant). For each partner already working with the
      Society (antiq_typewriter's member discount first), add it to
      Administration → Partners, draft its memorandum (F-26) and have the
      President sign it with the signed PDF: an offer reaches members only
      while a signed memorandum grants it. Role holders sign their
      Conflict of Interest Declaration (F-18) under Account → Declarations;
      the platform owner's own organizations (Baghdad College Foundation,
      The IDEA IQ, which hosts the Vercel team) belong on it, and whoever
      declares a conflict with a partner cannot sign its memorandum.
- [ ] **Recognition (B4):** the Faculty Advisor needs a Nexus account with
      the `faculty_advisor` role to countersign certificates (B4.5: signed
      by the President and the Faculty Advisor). Decide in Council whether
      volunteers (hours, not a term) get certificates; if yes, switch on
      `features.volunteer_certificates` in Administration → Settings.
      Approve the certificate wording for the kinds the Printables do not
      cover (Honorary Membership, volunteer, production, partner).
- [ ] **Backups:** add `BACKUP_PASSPHRASE` (a long random passphrase kept in
      your password manager) to the GitHub `production` environment. Then
      `.github/workflows/backup.yml` stores an encrypted dump every night
      for 30 days. Run it once from Actions to check it.
- [ ] **Leave Mintlify (owner, 2026-10-09):** `apps/docs` is gone. Ask me
      before each DNS change; the steps:
      1. Vercel → sal-web → Settings → Domains → add `docs.auibsal.org`, then
         in Cloudflare point the `docs` CNAME at Vercel instead of Mintlify.
         Old links then redirect (documents → auibsal.org, handbook → the
         Nexus, platform pages → `docs/platform` on GitHub).
      2. Delete the Mintlify deployment `theideaiq` (Mintlify dashboard), and
         the Liveblocks account.
- [ ] **Design system behind our sign-in:** Vercel → sal-storybook →
      Settings → Domains → add `design.auibsal.org` (Cloudflare: `design`
      CNAME to Vercel); Environment Variables → `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the public values) and
      `NEXT_PUBLIC_APP_URL=https://nexus.auibsal.org`; then Settings →
      Deployment Protection → Vercel Authentication off (the gate in
      `apps/storybook/middleware.ts` takes over; it fails closed). The Nexus
      session cookie must be shared (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.auibsal.org`
      on sal-nexus).
- [ ] **Co-editing on Supabase Realtime:** Dashboard → Realtime → Settings →
      turn off "Allow public access" (only private, checked channels). Remove
      `LIVEBLOCKS_SECRET` from sal-api and `NEXT_PUBLIC_LIVEBLOCKS_ENABLED`
      from sal-nexus in Vercel.
- [ ] **Code security:** in GitHub Settings → Code security, turn on the
      dependency graph, secret scanning and push protection; then add the
      repository variable `DEPENDENCY_REVIEW` = `on` (Settings → Secrets and
      variables → Actions → Variables) so CI's dependency review runs.
- [ ] **sal-emails** has no app since PR #64: delete it in Vercel
      (Settings → Advanced → Delete Project).
- [ ] **Founding voters in the Constitution:** the first-100 rule departs
      from Constitution 3.3(b) and Bylaws B3.3. Add a transitional provision
      (for example "For the founding year, ending May 13, 2027, the first one
      hundred Members are Voting Members from the day they join") before the
      Constitution is adopted on Charter Day (October 13), or by amendment
      after it.
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
- [x] ~~Liveblocks secret~~: Liveblocks replaced by Supabase Realtime (2026-10-09).
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
- [ ] **Sign in with SAL (for the Journal team's app):** Supabase →
      Authentication → OAuth Server: on, path `/oauth/consent`, dynamic
      registration off; URL Configuration → Site URL
      `https://nexus.auibsal.org`; for OpenID Connect ID tokens, Settings →
      JWT Keys → asymmetric keys. Then register the team's app (OAuth Apps →
      Add), send them the client id privately, and approve it in Nexus →
      Settings → Third-party apps with "Name and language" and "AUIB
      Literary Journal". Steps: `docs/platform/api.md`.
- [ ] **Phone notifications (Web Push) keys:** run
      `bunx web-push generate-vapid-keys` once. Put the public key in
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on sal-nexus and sal-api, the private
      key in `VAPID_PRIVATE_KEY` on sal-api only, then redeploy both. Until
      then the Profile section says the browser can't show notifications and
      everything still goes by email.
- [ ] **Owner dashboard steps** listed in the SAL Platform Master Guide
      (claude.ai/code/artifact/4f305659-631a-4244-adbd-18b93a8e10a1): `SENTRY_AUTH_TOKEN` on the
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
- [x] ~~`docs.auibsal.org` on Mintlify~~: replaced (2026-10-09, decision below).
- [x] GA4: later; the code stays behind `NEXT_PUBLIC_GA_ID`.
- [x] Collaboration is back in scope (owner, 2026-10-05); on Supabase
      Realtime since 2026-10-09 (decision below).

## Decisions

- **Third-party apps and the API** (owner, 2026-10-08): a Journal team at
  AUIB wants to sign members in with their SAL account and run the
  editorial flow from its own tool. Sign-in is the Supabase OAuth 2.1
  server (free), the consent page is in the Nexus, and `/v1` on apps/api is
  the public API. Because an OAuth token can do anything the member can,
  the database limits each app to the areas the Society granted it
  (`access.oauth_clients`, a restrictive policy on every table, a
  pre-request check for functions); membership, elections, charity and
  roles are never available to apps, and apps/api's own endpoints refuse
  app tokens (migration `20261008001500`).
- **Phone notifications** (owner, 2026-10-08): Web Push, not Knock or a
  native app; free and vendor-free. Email stays the record.
- **Site-wide Arcjet check removed** (owner, 2026-10-08): the public site
  serves published pages only; Arcjet stays on the public form in apps/api.

- **Online ballots** (owner, 2026-10-08): every election is voted online in
  the Nexus under Bylaws B6: the voter list freezes when notice is given
  (B6.2), only AUIB accounts vote (B6.7), one ballot each, ballots and voter
  lists deleted a year after voting closes (B6.11). The elections flag is on
  (migration `20261008000900`).
- **Staff and voting** (owner asked, 2026-10-08): roles do not make anyone a
  Voting Member. The Constitution (3.3(b)) and Bylaws (B3.3) tie voting to
  two recorded activities this or last semester; Council and team meetings
  count (B3.2) when their attendance is recorded. University faculty and
  staff are Honorary Members and do not vote (3.3(d)).
- **Journal Issue 1 call** (owner, 2026-10-08): open now, from October 8 to
  November 26, 2026 (the close date from the Strategic Plan, SAL-STR-01, a
  draft), at most two pieces each, open theme (migration `20261008001000`).
  The Arabic name is «مجلة الجامعة الأمريكية الأدبية» (owner's choice).
- **Founding voters** (owner, 2026-10-08): until May 13, 2027 (end of Spring
  2027), the first 100 verified Members (not Honorary or Alumni) are Voting
  Members from the day they join; everyone else, and everyone after that
  date, needs two recorded activities. Both values are settings
  (`membership.founding_voters`, `membership.founding_voters_until`;
  migration `20261008001100`).
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
- **Our own sign-in everywhere, no vendor branding** (owner, 2026-10-09).
  Mintlify's free plan keeps its branding and has no member-only pages, and
  the repository is public anyway, so: documents stay on auibsal.org, the
  officer handbook lives in the Nexus (`governance.handbook_pages`, officers
  with `library.read`, edited by `governance.manage`), runbooks are Markdown
  in `docs/platform`, and docs.auibsal.org redirects. The design system
  (Storybook, rebranded) sits behind a gate that accepts the Nexus session.
  Live co-editing moved from Liveblocks (its badge only comes off on a paid
  plan) to Supabase Realtime (migration `20261008001600`).
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
- Partnerships (Oct 9, 2026): one generic Partners module, no code per
  partner. Tables live in the `governance` schema (a new schema would need
  a dashboard change to expose it). What a partner may do on the platform
  comes only from the grants of a signed memorandum in force; signing goes
  through `governance.sign_partner_agreement`, which refuses anyone with a
  declared conflict (P8.3). Partners are public only while active, listed
  and under a signed memorandum. Member offers are display-only (no
  payments). `charity.partners` stays for campaign pages.
- Recognition (Oct 9, 2026): recorded service is
  `membership.service_records` (Form F-16): shifts a program manager marks
  as worked, event staff hours, and members' own entries, always confirmed
  by someone else. Certificates (F-28, Fellowship, Honorary Membership)
  issue only after the President signs and the Faculty Advisor
  countersigns (`membership.sign_certificate`), take the year's next
  serial, and are checked at auibsal.org/verify. The PDF is the browser's
  print of the Nexus certificate page (Arabic shaping stays correct; no
  PDF library or cost).
- Journal partner pathway (Oct 9, 2026): a call names partners
  (`journal.call_partners`) whose verified members may submit, only while
  the partner's signed memorandum grants `journal_submissions`; the same
  pledges, limits and blind review apply. `journal.submissions.partner_id`
  is identity-side (never on blind entries). `assign_reader` refuses a
  reader with a declared conflict with that partner (P8.3). People
  verified as a partner's members get a guest Nexus (Journal, profile,
  service, certificates). The Guest Editor role (issue scope) goes only to
  a partner's member whose memorandum grants `guest_editing`.
- Productions (Oct 9, 2026): `programmes.productions` with stages from
  proposal to closed. No production reaches performances, and no
  performance (a SAL event) is linked, until the script's rights are
  cleared by someone other than whoever recorded them; a licensed script
  needs the license on file (library/productions, opened through apps/api
  `/files/rights`). Audition notes are never readable by the person
  auditioning. Members choose whether their credit is public. Partners
  co-produce only under a memorandum granting `productions`. A new
  `production` scope and the Production Lead role run one production;
  hours become recorded service, a closed production drafts certificates
  for its credited members, and the lead signs the Program Report (F-25,
  section B). Public page: auibsal.org/productions (footer).
- Forms (Oct 9, 2026): one engine for every form not built into its own
  module (F-03, F-04, F-06, F-09, F-10, F-11, F-13, F-14, F-17, F-19, F-20,
  F-24, F-25 A, F-27, F-29). `governance.form_types` says who may fill
  each in and which permission (held Society-wide) handles it; fields are
  defined in `@repo/sal-data/forms`, transcribed from Templates & Forms.
  Submissions are written only through `governance.save_form` and
  `governance.handle_form`. Incident reports go only to Society-wide
  events managers. Concerns (F-20) may be anonymous (no account stored)
  and are routed by permission: one about the Vice President never
  reaches the Vice President, one about the President never reaches the
  President. Form submissions have no activity-log trigger (it would
  record who sent an anonymous concern). Expense claims record what is
  owed; the Society still makes no online payments. Forms already part
  of other modules are linked from Account → Forms. The standard letters
  (L-01 to L-10, F-05) are fill-in-the-brackets templates in Admin →
  Forms and letters, quoted verbatim.
- Documents (Oct 10, 2026): the foundational documents are text in
  `governance.society_documents`, converted word for word from the PDFs in
  docs-source/. Public ones render on auibsal.org/documents (cached under
  the `documents` tag, refreshed on save); internal ones exist only in the
  Nexus. The PDFs are no longer published. Arabic text that the PDFs could
  not give back is TODO(content).
- Role rules (Oct 10, 2026): `access.assign_role` refuses a second
  Council seat (Constitution 6.6; so never President and Treasurer, B9.8),
  any other role for the Faculty Advisor (9.1), the same role twice, and a
  third role or second leadership role (B5.5) unless an adopted Council
  resolution grants a founding-term exception. Existing assignments are
  left as they are; the public Council roster lists each person once per
  office.
- Notion (Oct 10, 2026, owner; migration `20261010000300`,
  `docs/platform/notion.md`): the officers' team work lives in the Notion
  workspace (Plus for education clubs): projects, tasks, meetings, the
  content calendar, the handbook and the internal documents. Events and
  news are written in Notion and published by apps/api when Status is
  Ready to publish, after checking that the page's last editor (matched by
  AUIB email) holds events.manage or content.manage; roles needing two-step
  sign-in count only for accounts with a verified second factor, since a
  Notion session is not ours. Notion gets read-only copies of officers,
  programs, the document and minutes registry and Journal counts (numbers
  only). Members, RSVPs, ballots, submissions, the ledger, certificates and
  confidential forms never leave the Nexus. Officers sign in to Notion with
  their AUIB address (Notion SSO needs Business or Enterprise), which
  narrows the Oct 9 "our own sign-in everywhere" decision for this
  workspace only. Invite-only; the auib.edu.iq allowed-domain setting stays
  off; volunteers are guests on their project's pages.
- UX pass (Oct 10, 2026): setup asks for the member's name (accounts made
  by a sign-in link had none, so they showed blank across the Nexus), and
  members without one are sent back to setup once. Admin sections are in
  five groups; below `lg` they open from one "Administration" button. Admin
  tables stack into labelled rows below `md` (nothing scrolls sideways).
  The member home shows notices only when there are some; the calendar
  feed moved to Profile and privacy. `FormHeader` follows its page's theme
  (white symbol on ink) through the `on-ink` variant. The public home
  shows the flagship programs.
- Owner cleanup (Oct 9, 2026, migration `20261010000200`): Shaheen Farjo
  keeps only the President seat held since Oct 4; his other assignments
  are ended. Test content is removed (the "Hey" news draft, the two test
  journal submissions, a duplicate member offer, a test verification
  request). The manuscript file of the withdrawn test submission stays in
  the `submissions` bucket until deleted in the dashboard.
- Reference data after the first migration: later migrations may add
  permissions, roles and grants with plain inserts; `@repo/rbac`'s mirror
  test reads every migration in order.
- Passkeys (Oct 9, 2026): Supabase Auth's own WebAuthn, no extra service.
  Relying Party ID `auibsal.org`; a passkey sign-in is a first factor, so
  roles with `requires_mfa` still ask for the authenticator code.
- Side effects (emails, revalidation) are queued in `core.outbox` inside the
  transaction; an insert trigger hands each to apps/api (pg_net), and a
  drain every ten minutes retries what failed.
- Supabase advisor (Oct 9, 2026): fixed the media bucket listing and the
  always-true sign-up check (migration `20261009000000`). Left as is, by
  design: SECURITY DEFINER functions callable by visitors or members (each
  returns only public data or checks permissions inside; the uid-taking
  membership helpers answer only about the caller unless the caller manages
  members), "multiple permissive policies" and "unused index" (performance
  notes, negligible at the Society's scale), and leaked-password protection
  (a paid feature the owner canceled).

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
- [x] Phone notifications (Web Push, free, no vendor): the Nexus is
      installable (manifest, `public/sw.js`); Profile and privacy turns them
      on per device (`core.push_subscriptions`, RLS, `core.save_push_subscription`),
      with a test notice; sign-out removes the device; every outbox notice
      to a member also goes to their devices after the email (`apps/api/lib/push.ts`).
      iPhone needs the Nexus on the Home Screen (iOS 16.4+).
- [x] Sign in with SAL: consent page (`/oauth/consent`), Connected apps in
      Profile and privacy (disconnect), Settings → Third-party apps
- [ ] Sign in with SAL next: file submissions and publishing through `/v1`,
      signed webhooks to apps, an OpenAPI description (`docs/platform/api.md`)
- [x] Events page: browse, book with registration questions, places left, waitlist join/leave, give a place back (tickets stay on Home); the public RSVP button links to the event's card
- [ ] Past attendance on the Events page
- [x] Journal: submit (rich text or files, translation fields, Human Authorship reconfirmed each time), my submissions, revise when returned, withdraw, sign the Publication Agreement (text is `TODO(content)`)
- [x] Programs: rotas with upcoming shifts, places left (`programmes.shift_places`), sign up, give back
- [x] Productions (Programs → Productions): open auditions with sign-up, and for the company their credits (show my name or not) and rehearsals
- [x] Forms (Account → Forms): fill in, save drafts, send, print; anonymous concerns; checklists and dossiers kept up to date by their subject; links to the forms that live in other sections
- [ ] Society (Book of Members, roster, minutes, elections)

### Nexus — admin (§8)
- [x] Shell and module gating by permission (UX only; RLS and RPCs enforce)
- [x] Overview (`core.admin_overview()`), Members (directory, verification queue, tiers, manual activity, roles via `access.assign_role`)
- [x] Events (editor, questions, attendance, camera QR check-in)
- [x] Content (news, pages, announcements, homepage slots, media library; live co-editing on Supabase Realtime)
- [x] Officer handbook in the Nexus (Account → Officer handbook), edited in place by governance managers
- [x] Charity (campaigns, ledger with sign-off and reversals, receipts through signed URLs; winter-set cost is a placeholder setting)
- [x] Programs, Governance (minutes co-edited, elections, spending, library uploads), Activity log, Settings
- [x] Productions (`/admin/productions`): stages, rights clearance by a second person, auditions with private panel notes, cast and crew credits, hours as service, rehearsals, performances linked to events, partners, Program Report (F-25 B), drafted certificates; public page auibsal.org/productions
- [x] Forms and letters (`/admin/forms`): a queue per form with acknowledge and answer dates, office-use boxes, print; standard letters L-01 to L-10 and F-05 to fill in, copy and print
- [x] Journal issues, pieces, contributors; accepted work becomes a draft piece; publishing blocked until the agreement is signed
- [x] Journal pipeline (`/admin/pipeline`): per-issue tabs by role — my reading (rubric v2 scoring), intake (return for formatting, send to blind review, originals via `/files/submission`), reader assignment, drag-and-drop board with a keyboard Move menu, selection by average and band, decisions with author reveal, Advisory Board flagged view, calls
- [x] Blind copies: `/files/blind` strips PDF info/XMP/annotation authors, image EXIF, DOCX properties and revision authors; never falls back to the original
- [x] CSV exports through apps/api (members, attendance, ledger, spending)
- [x] Migrations `20261005000000_admin`, `…0100_waraq_publishing` and `…0200_waraq_pipeline` applied to production (2026-10-06)

### Public site (§6)
- [x] Layout (skip link, header, footer, language switch), home (events, the Journal, Warmth Meter, calls, join band), 404
- [x] Revalidation route (cache tags), sitemap (existing pages only, hreflang), robots
- [x] Documents as text (`governance.society_documents`, migration `20261010000100`): the six public documents are pages on auibsal.org/documents with a table of contents and their status; internal ones (Founding Proposal, Operations Playbook, Templates & Forms, Printables) are read in the Nexus (Account → Society documents) by officers who read the internal library; governance managers edit every document in Admin → Documents (tables included). No PDFs are published.
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
- [x] Public API `/v1` (me, Journal calls, issues, submissions, reviews and
      scores, entries and decisions), run as the member with RLS; app tokens
      accepted only there
- [x] Web Push sender (`lib/push.ts`) and `/push/test`

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

- TODO(content): Arabic titles, summaries and text for the officer handbook
  pages (`governance.handbook_pages`); the Nexus shows English until then.
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
- The Issue 1 call's theme and eligibility text, if any (open theme until
  then), and the Journal Submission Guidelines it should link to.

- TODO(content): the text of the internal documents (Founding Proposal SAL-PRP-01, Operations Playbook SAL-OPS-01, Templates & Forms SAL-OPS-02, Printables SAL-PRT-01): paste it in the team's Notion workspace (Handbook and internal documents), where those pages wait for it. It stays out of this public repository.
- TODO(content): the Arabic summary of the Constitution and the Arabic welcome page of the Member Handbook (the PDFs' Arabic text layer could not be recovered); enter them as each document's Arabic text.
- TODO(content): Arabic versions of the standard letters (L-01 to L-10,
  F-05); the Templates & Forms has them in English only.
- The Media Release (F-17) is to be reviewed by Student Life before first
  use (as the form says).

## needs-native-review (Arabic written for the platform)

- `packages/internationalization/messages/ar.json` — every string (all of it
  was written for the platform; none came from a source document), except
  the motto «والقرطاسُ والقلم» and the Society's name «جمعية الفنون والآداب»,
  which come from the brief.
- `access.roles.name_ar` (reference-data migration): all 24 role names,
  and «مدير الشراكات والتواصل» (`20261009000100_partners.sql`), «محرر ضيف»
  (`20261009000300_journal_partners.sql`) and «قائد العمل المسرحي»
  (`20261009000400_productions.sql`).
- Productions (2026-10-09): `nexus.productions.*`, `nexus.admin.productions.*`
  and `web.productions.*`, including the stage, department and audition
  status names.
- Forms (2026-10-09): `nexus.forms.*` (every form title, purpose, field and
  option, including the Arabic of the F-17 media release, which the form
  itself says must be checked by a native speaker) and `nexus.admin.forms.*`.
- `core.programmes.name_ar`: every name.
- Notion (2026-10-10): `nexus.nav.workspace`, `nexus.admin.notion.*` and
  `nexus.admin.settings.notion.*`.
- UX pass (2026-10-10): `nexus.setup.name.*`, `nexus.home.greetingPlain`,
  `nexus.admin.nav.groups.*`, `web.home.whatWeDo`, `web.home.allPrograms`,
  `web.home.closes`, `web.programmes.major` and `web.programmes.regular`.
- `charity.campaigns.unit_label_ar` default «أطفال كُسوا».
- `core.semesters` names in pgTAP fixtures are test-only (no review needed).
- The transliteration «النِّكسَس» for "the Nexus".
- Arabic document titles in `governance.society_documents` (migration `20261010000100`, except «دليل السياسات»), the internal documents' Arabic titles, and `nexus.documents.*` / `nexus.admin.documents.*`.
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

- AUIB Literary Journal (2026-10-08): «مجلة الجامعة الأمريكية الأدبية» and every Arabic
  string added that day (`nexus.society.*`, `nexus.next.*`, the two-step
  panel, setup progress and pledge reasons, the reading timeline, overview
  context sentences, Society contacts settings).
- Online ballots (2026-10-08): `nexus.society.elections.{onList,notOnList,auibOnly,notEligible,status.notice}`,
  `nexus.admin.governance.elections.{giveNotice,giveNoticeConfirm,noticeGiven,openVotingConfirm,flagOff,statuses.notice}`,
  `web.journal.opensCloses`, and the Issue 1 names «العدد الأول» and
  «العدد الأول: دعوة للمشاركة».
- Founding voters (2026-10-08): `nexus.home.voting.founding` and the added
  sentence in `web.join.steps.twoThings.body`.
- Phone notifications (2026-10-08): `nexus.profile.push.*` and `pushTest`
  in `packages/email/copy.ts`.
- Sign in with SAL (2026-10-08): `nexus.oauth.*`, `nexus.profile.apps.*`
  and `nexus.admin.settings.apps.*`.
- Officer handbook and design-system sign-in (2026-10-09): `nexus.handbook.*`,
  `nexus.nav.handbook`, `auth.continue.*`.

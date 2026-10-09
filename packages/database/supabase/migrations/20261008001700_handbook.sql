-- The officer handbook moves from the public docs site (Mintlify) into the
-- Nexus, under our own sign-in. Pages live here, readable by people who may
-- read the internal library and edited by governance managers in
-- Administration. The starting text below is the handbook as it stood on
-- the docs site (already public in the repository's history); edits made in
-- the Nexus from now on stay private.
--
-- Arabic titles and bodies are TODO(content) (PROGRESS.md): the Nexus shows
-- the English until they are written.

create table governance.handbook_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  section text not null check (section in ('start', 'running', 'making')),
  sort integer not null default 100,
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text check (char_length(title_ar) <= 200),
  summary_en text check (char_length(summary_en) <= 400),
  summary_ar text check (char_length(summary_ar) <= 400),
  -- Sanitized HTML (on save and on render), as for news and pages.
  body_en text not null default '' check (char_length(body_en) <= 200000),
  body_ar text check (char_length(body_ar) <= 200000),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table governance.handbook_pages is
  'The officer handbook, shown in the Nexus to people who may read the internal library.';

create index handbook_pages_section_idx on governance.handbook_pages (section, sort);

create trigger set_updated_at before update on governance.handbook_pages
  for each row execute function private.set_updated_at();

create trigger log_activity after insert or update or delete on governance.handbook_pages
  for each row execute function private.log_activity();

alter table governance.handbook_pages enable row level security;

create policy "Officers read the handbook"
  on governance.handbook_pages for select to authenticated
  using (
    (select access.has_permission_anywhere('library.read'))
    or (select access.has_permission('governance.manage'))
  );

create policy "Governance managers edit the handbook"
  on governance.handbook_pages for all to authenticated
  using ((select access.has_permission('governance.manage')))
  with check ((select access.has_permission('governance.manage')));

-- Governance is never granted to third-party apps (20261008001500).
create policy "Third-party apps reach only their areas"
  on governance.handbook_pages as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select, insert, update, delete on governance.handbook_pages to authenticated;
grant all on governance.handbook_pages to service_role;

insert into governance.handbook_pages (slug, section, sort, title_en, summary_en, body_en) values
  ($h$introduction$h$, $h$start$h$, 10, $h$The Nexus for officers$h$, $h$What the Nexus is, who sees what, and where to start.$h$, $h$<p>The Nexus (nexus.auibsal.org) is where members book events, send work to the
AUIB Literary Journal and sign up for shifts, and where officers run the
Society: events, the Journal, news, the charity ledger, members and settings.</p>
<h2>Who sees what</h2>
<p>Every screen in <strong>Administration</strong> depends on your role. The database itself
checks your role on every read and write, so a section you can&#39;t open is one
your role doesn&#39;t cover, not a fault. Ask the President or the General
Secretary if you need access.</p>
<ul>
<li><strong>Council officers, directors and the Elections Committee</strong> sign in with a
second step (a code from an authenticator app). See <a href="https://nexus.auibsal.org/en/handbook?page=sign-in">Signing in</a>.</li>
<li><strong>Program leads, editors and event staff</strong> see only their own program,
issue or event.</li>
</ul>
<h2>Where things appear</h2>
<ul>
<li><strong>A published event</strong>: auibsal.org/events and the Nexus Events page</li>
<li><strong>A published news post</strong>: auibsal.org/news, within a minute</li>
<li><strong>A Journal piece or issue</strong>: auibsal.org/journal</li>
<li><strong>A signed-off ledger entry</strong>: The Warmth Meter on auibsal.org/give</li>
<li><strong>Contact details in Settings</strong>: auibsal.org/contact</li>
</ul>
<p>Drafts never appear publicly.</p>$h$),
  ($h$sign-in$h$, $h$start$h$, 20, $h$Signing in$h$, $h$Email sign-in, the sign-in link, and two-step sign-in for Council roles.$h$, $h$<h2>Your account</h2>
<p>Sign in with your AUIB address. AUIB addresses get a <strong>sign-in link</strong> by
email by default; choose &quot;Use my password instead&quot; if you set one.</p>
<h2>Two-step sign-in (Council and Elections)</h2>
<p>The Council&#39;s officers and directors and the Elections Committee handle the
Society&#39;s money, records and votes, so their tools open only after a second
step.</p>
<ol>
<li>Install an authenticator app on your phone (Google Authenticator,
Microsoft Authenticator, 1Password or similar).</li>
<li>Open <strong>Account → Administration</strong> in the Nexus. It asks you to set up
two-step sign-in: choose <strong>Set up my authenticator</strong>.</li>
<li>Scan the QR code with the app (or type the key shown), then enter the
six-digit code.</li>
</ol>
<p>After that, each time you sign in, Administration asks for the current code.
Lost your phone? The project owner removes your old factor in the Supabase
dashboard (Authentication → Users → your account → MFA), and you set up
the app again.</p>$h$),
  ($h$events$h$, $h$running$h$, 30, $h$Events$h$, $h$Publishing events, bookings, the waitlist and check-in.$h$, $h$<h2>Publish an event</h2>
<p><strong>Administration → Events → New event.</strong> Give the title in both languages,
the date and time (Baghdad time), the venue and, if places are limited, the
capacity. Add registration questions only if you need the answers.</p>
<p>An event goes live when you publish it. Members-only events appear only in
the Nexus.</p>
<h2>Bookings and the waitlist</h2>
<p>Members book from the Nexus Events page. When an event is full, new
bookings join the waitlist. When someone gives their place back, or you
raise the capacity, the next person waiting gets it and an email.</p>
<h2>Check-in</h2>
<p>Event staff open the event in <strong>Administration → Events</strong> and scan each
member&#39;s ticket code from their Nexus home page, or find them by name.
Attendance counts toward Voting Member status.</p>
<h2>Canceling</h2>
<p>Cancel rather than delete: the event stays listed as canceled, and you
should tell the people who booked.</p>$h$),
  ($h$journal$h$, $h$running$h$, 40, $h$The AUIB Literary Journal$h$, $h$Calls, blind review, selection, decisions and publishing.$h$, $h$<h2>The pipeline</h2>
<ol>
<li><strong>Call.</strong> An editor opens a call for an issue, with its dates and the
limit per person.</li>
<li><strong>Intake.</strong> The Submissions Manager checks formatting and returns work
that needs fixing. They hold the key between blind ids and names, and
never score.</li>
<li><strong>Blind reading.</strong> Readers score each piece from its blind id. When they
disagree, a third reader decides.</li>
<li><strong>Selection.</strong> The editors choose the issue from the scored work.</li>
<li><strong>Decision.</strong> Authors hear by email either way. Accepted work is
published only after the author signs the Publication Agreement.</li>
</ol>
<p>Readers and editors never see an author&#39;s name before a decision.</p>
<h2>Publishing</h2>
<p><strong>Administration → Journal: issues and pieces.</strong> Publish pieces and issues
when they are ready, or schedule them.</p>$h$),
  ($h$content$h$, $h$running$h$, 50, $h$News, pages and notices$h$, $h$What the public site and the Nexus say.$h$, $h$<h2>News</h2>
<p><strong>Administration → Content → News → New post.</strong> Write the title in both
languages and the text, then <strong>Publish</strong>. Two editors can work on the same
post at once; each sees the other&#39;s changes as they type.</p>
<h2>Pages</h2>
<p>Pages are for longer standing text. Two are waiting to be written:</p>
<ul>
<li><strong>The Founders&#39; Roll</strong>: create a page with the address <code>about/founders</code>.</li>
<li><strong>Traditions</strong> (Charter Night, the Ribbon, the Term Card): create a page
with the address <code>about/traditions</code>.</li>
</ul>
<h2>Notices</h2>
<p>Notices appear on members&#39; Nexus home pages, or as a banner on auibsal.org,
for the dates you choose.</p>$h$),
  ($h$charity$h$, $h$running$h$, 60, $h$Second Chapter and the ledger$h$, $h$Campaigns, recording money and sign-off.$h$, $h$<p>The Society takes no payments online. Money is counted by two people and
recorded in the ledger.</p>
<h2>Campaigns</h2>
<p><strong>Administration → Charity.</strong> The draft campaign <strong>Second Chapter 2026</strong>
(November 1–11) is ready. Before you set it active, fill in its target and
cost per unit, then publish it so it appears on auibsal.org/give.</p>
<h2>The ledger</h2>
<ul>
<li>Record each amount as it is counted.</li>
<li>A different person signs each entry off. You can&#39;t sign off an entry you
recorded.</li>
<li>Only signed-off entries count toward the Warmth Meter.</li>
<li>Mistakes are corrected with a reversing entry, never by editing.</li>
</ul>$h$),
  ($h$members$h$, $h$running$h$, 70, $h$Members, roles and elections$h$, $h$Verification, roles, Voting Members and online elections.$h$, $h$<h2>Verification</h2>
<p>AUIB addresses are verified when they confirm their email. Other addresses
(alumni, guests) wait in <strong>Administration → Members</strong> for an officer to
approve or decline.</p>
<h2>Roles</h2>
<p>Assign and end roles in <strong>Administration → Members</strong>. A role grants
permissions, sometimes only for one program, issue or campaign. Council
roles need two-step sign-in before they work.</p>
<h2>Voting Members</h2>
<p>A Member becomes a Voting Member on their second recorded activity in the
current or previous semester (Constitution 3.3(b), Bylaws B3.3). Holding a
Society role does not count by itself. An activity is any event, workshop,
salon, rehearsal, <strong>meeting</strong> or volunteer shift with recorded attendance
(B3.2).</p>
<p><strong>Founding year.</strong> Until May 13, 2027, the Society&#39;s first 100 verified
Members are Voting Members from the day they join; everyone after them
qualifies with two activities. Change the number or the date in
<strong>Settings</strong> (<code>membership.founding_voters</code>, <code>membership.founding_voters_until</code>).</p>
<p><strong>How attendance is recorded.</strong> At an event, open <strong>Administration → Events →
Check in</strong> on a phone and scan the member&#39;s code: the ticket QR on their
Nexus Home (under their next events) or, for walk-ins, the QR on their
membership card. You can also search by name. Each check-in is one activity.
Rota shifts and Council or team meetings are recorded by hand in
<strong>Administration → Members → a member → Add activity</strong>.</p>
<p>Faculty, staff and alumni are Honorary or Alumni Members and do not vote
(3.3(d), (e)).</p>
<h2>Elections (online)</h2>
<p>Every election is voted online in the Nexus, under the Elections Code
(Bylaws B6). The Elections Committee runs it from <strong>Administration →
Governance → Elections</strong>:</p>
<ol>
<li><strong>Create the election</strong> with its dates and add the four Executive Board
offices.</li>
<li><strong>Give notice</strong> at least one week before nominations open (B6.2). This
freezes the voter list: the register of Voting Members on that day.
Members who qualify later vote in the next election.</li>
<li><strong>Open nominations</strong> for one week (B6.3). Only people on the voter list
can stand; Committee members cannot.</li>
<li><strong>Close nominations for review</strong>, then approve or reject each nomination.</li>
<li><strong>Open voting</strong> for 48 hours (B6.7). Each person on the list casts one
ranked ballot, signed in with their AUIB account (@auib.edu.iq). The
ballot is stored apart from the voter, and nobody, not even the
Committee, can read who voted for whom.</li>
<li><strong>Count</strong> after voting closes, then <strong>publish</strong> the round-by-round
results (B6.11).</li>
</ol>
<p>Ballots and the voter list are deleted automatically one year after voting
closes (B6.11); the published results stay. A member without an AUIB account
can&#39;t vote online. If the Committee offers a paper ballot box (B6.7), count
it by hand and record the result in the minutes.</p>$h$),
  ($h$settings$h$, $h$running$h$, 80, $h$Settings$h$, $h$Semesters, contact details, the Journal's name and features.$h$, $h$<p><strong>Administration → Settings</strong> holds what the Society changes without a
developer:</p>
<ul>
<li><strong>Semesters and blackout dates.</strong></li>
<li><strong>Contact and the Faculty Advisor:</strong> the Society email, the link to The
Common Room on Telegram and the Faculty Advisor&#39;s name. They appear on
auibsal.org/contact and the Nexus Society page.</li>
<li><strong>The Journal&#39;s name</strong> in both languages.</li>
<li><strong>Pledge versions:</strong> raising one asks every member to accept it again.</li>
<li><strong>Feature flags:</strong> switch elections on or off.</li>
<li><strong>Third-party apps:</strong> apps outside the Nexus that members may sign in to
with their Society account, and what each may reach. See
<a href="https://github.com/auibsal/mono/blob/main/docs/platform/api.md">Sign in with SAL and the API</a>.</li>
</ul>$h$),
  ($h$brand$h$, $h$making$h$, 90, $h$Brand essentials$h$, $h$The rules every poster, post and document follows, from the binding Brand Book.$h$, $h$<p>Everything carrying the Society&#39;s name follows the Brand Book (SAL-BRD-01, Brand and Identity v4, with the v5 Screens amendment of October 8, 2026). This page is the short version for officers; the <a href="https://github.com/auibsal/mono/blob/main/brand/BRAND-BOOK.md">full Brand Book</a> and the logo files live in the repository&#39;s <code>brand/</code> folder.</p>
<h2>Voice</h2>
<p>The Society sounds like a well-read friend: warm, precise and never grand.</p>
<ul>
<li><p><strong>&quot;We would love you to join us.&quot;</strong>: &quot;An AMAZING opportunity!!!&quot;</p>
</li>
<li><p><strong>&quot;Tuesday, October 13, 4 PM, Room [x].&quot;</strong>: &quot;Soon, somewhere on campus.&quot;</p>
</li>
<li><p><strong>&quot;A journal read blind and printed with care.&quot;</strong>: &quot;Iraq&#39;s premier literary institution.&quot;</p>
</li>
<li><p><strong>&quot;The worst poem at AUIB wins.&quot;</strong>: Jokes at a person&#39;s expense</p>
</li>
<li><p><strong>Names.</strong> &quot;AUIB Society of Arts and Letters&quot; in full on first formal use, then &quot;the Society&quot; or &quot;SAL&quot;. Never &quot;the club&quot;.</p>
</li>
<li><p><strong>The journal</strong> is the <strong>AUIB Literary Journal</strong> («مجلة الجامعة الأمريكية الأدبية»). &quot;Waraq&quot; was its working title. Side Quest is still a working title.</p>
</li>
<li><p><strong>Endorsed programs</strong> carry &quot;a Society of Arts and Letters programme&quot; («من برامج جمعية الفنون والآداب»), spelled as written.</p>
</li>
<li><p><strong>Formats.</strong> Dates as &quot;Tuesday, October 13&quot;; times as &quot;6:00 PM&quot;; money as &quot;50,000 IQD&quot;.</p>
</li>
<li><p><strong>American English</strong> everywhere (program, color, organization), except text quoted from the Society&#39;s documents.</p>
</li>
<li><p><strong>Arabic</strong> is written for Arabic readers and checked by a native speaker. Never ship a translation as an afterthought.</p>
</li>
<li><p>No emoji, no exclamation marks in headlines. Tag @auibsal and give the date on every post.</p>
</li>
</ul>
<h2>Color</h2>
<p>Crimson, ink and white lead; six quiet tints support them. Never add a color, and no program may add one.</p>
<ul>
<li><p><strong>White</strong>: About 60% of any piece; the page itself</p>
</li>
<li><p><strong>Crimson</strong>: About 22%; calls, moments, the symbol</p>
</li>
<li><p><strong>Ink</strong>: About 12%; text, recruiting posts, the Nexus</p>
</li>
<li><p><strong>Tints</strong>: About 6%; cards and quiet grounds</p>
</li>
<li><p>Never put crimson text or the crimson symbol on ink.</p>
</li>
<li><p>At most one full-bleed crimson band per page.</p>
</li>
<li><p>Paper (the warm off-white) belongs to the AUIB Literary Journal; elsewhere the page is white.</p>
</li>
</ul>
<h2>Type</h2>
<p><strong>Ubuntu</strong> for the Society, <strong>Ubuntu Arabic</strong> for Arabic (shipped in <code>brand/fonts</code>, never substituted), <strong>Ubuntu Mono</strong> for document codes and form numbers (<code>SAL-GOV-01</code>, <code>F-14</code>). Arabic sits one step larger than the English beside it.</p>
<h2>Logos</h2>
<p>Use the supplied files in <code>brand/logos</code>; never retype, redraw, recolor, stretch, rotate or add effects.</p>
<ul>
<li><strong>Horizontal (symbol + English)</strong>: The default</li>
<li><strong>Bilingual (English · symbol · Arabic)</strong>: Anything public: calls, posters, certificates</li>
<li><strong>Stacked</strong>: Square spaces, stickers, merchandise</li>
<li><strong>Symbol alone</strong>: Avatars, favicons, stamps, once the name appears elsewhere</li>
</ul>
<p>Clear space is the depth of the notch on every side. Minimum: symbol 24 px on screen or 6 mm in print; horizontal lockup 45 mm wide in print. Where the AUIB logo appears it leads. The round SAL Key from v3 is retired.</p>
<h2>Posts and print</h2>
<ul>
<li><strong>Posts (1080 × 1350):</strong> Society name top left, symbol top right, a two- or three-word headline with a full stop, one line of Arabic at bottom right on every call, the date and @auibsal.</li>
<li><strong>Grounds by purpose:</strong> crimson for calls and moments, ink for recruiting, white for membership, the lightest crimson tint for regular programs.</li>
<li><strong>Posters</strong> A3/A4 with the symbol and a QR code at bottom right · <strong>Term Card</strong> A6 · <strong>Membership cards</strong> 85 × 55 mm · <strong>Certificates</strong> A4 landscape with a double crimson rule.</li>
</ul>
<h2>Photos</h2>
<p>Our own photos of our own people, taken with consent (Policy P5). Never shoot anyone wearing a camera-shy sticker, identifiable children, or people praying, in distress or in private moments. No stock photos of books or typewriters.</p>$h$);

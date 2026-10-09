-- The Society's foundational documents as text, not PDFs: the Constitution,
-- the Bylaws, Roles & Staffing, the Policy Manual, the Strategic Plan and
-- the Member Handbook are public pages on auibsal.org/documents; the
-- Founding Proposal, the Operations Playbook, Templates & Forms and the
-- Printables are internal, read only in the Nexus by people who may read
-- the internal library. Governance managers edit every document in the
-- Nexus (Administration → Documents), with its status, which every page
-- shows (a draft is never presented as adopted).
--
-- The public text below was converted from the PDFs in docs-source/
-- (already public), word for word. The PDFs' Arabic text layer is not
-- recoverable, so the Arabic summary of the Constitution and the Arabic
-- welcome page of the Member Handbook are TODO(content): the pages show the
-- English (the authoritative text) until they are entered. The internal
-- documents start empty: their text is not in this public repository and
-- is entered in the Nexus (TODO(content) in PROGRESS.md).

create table governance.society_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  code text not null unique check (code ~ '^SAL-[A-Z]{3}-\d{2}$'),
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text check (char_length(title_ar) <= 200),
  -- The cover's subtitle, verbatim.
  summary_en text check (char_length(summary_en) <= 600),
  summary_ar text check (char_length(summary_ar) <= 600),
  -- Public on auibsal.org, or internal (the Nexus only).
  audience text not null default 'internal' check (audience in ('public', 'internal')),
  status text not null default 'draft' check (status in ('draft', 'adopted', 'superseded')),
  -- The cover's version label, e.g. "Draft 1".
  version text check (char_length(version) <= 60),
  -- The date on the cover; the planned ratification while a draft; the
  -- date of adoption once recorded (never inferred).
  dated date,
  ratification date,
  adopted_on date,
  -- Sanitized HTML (on save and on render), as for news and pages.
  body_en text not null default '' check (char_length(body_en) <= 600000),
  body_ar text check (char_length(body_ar) <= 600000),
  sort integer not null default 100,
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table governance.society_documents is
  'The Society''s foundational documents as text: public ones on auibsal.org/documents, internal ones in the Nexus.';

create index society_documents_audience_idx on governance.society_documents (audience, sort);
create index society_documents_updated_by_idx on governance.society_documents (updated_by);

create trigger set_updated_at before update on governance.society_documents
  for each row execute function private.set_updated_at();

-- Whoever saves an edit is recorded as its author.
create function private.set_document_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger set_document_editor before update on governance.society_documents
  for each row execute function private.set_document_editor();

create trigger log_activity after insert or update or delete on governance.society_documents
  for each row execute function private.log_activity();

create trigger revalidate after insert or update or delete on governance.society_documents
  for each statement execute function private.queue_revalidation('documents');

alter table governance.society_documents enable row level security;

create policy "Everyone reads the public documents"
  on governance.society_documents for select to anon, authenticated
  using (audience = 'public');

create policy "Officers read the internal documents"
  on governance.society_documents for select to authenticated
  using (
    audience = 'internal'
    and (
      (select access.has_permission_anywhere('library.read'))
      or (select access.has_permission('governance.manage'))
    )
  );

create policy "Governance managers keep the documents"
  on governance.society_documents for all to authenticated
  using ((select access.has_permission('governance.manage')))
  with check ((select access.has_permission('governance.manage')));

-- Governance is never granted to third-party apps (20261008001500).
create policy "Third-party apps reach only their areas"
  on governance.society_documents as restrictive for all to authenticated
  using ((select private.client_allows('governance')))
  with check ((select private.client_allows('governance')));

grant select on governance.society_documents to anon;
grant select, insert, update, delete on governance.society_documents to authenticated;
grant all on governance.society_documents to service_role;

insert into governance.society_documents
  (slug, code, title_en, title_ar, summary_en, audience, status, version, dated, ratification, adopted_on, sort, body_en)
values
  ('constitution', 'SAL-GOV-01', 'The Constitution', 'الدستور', 'The founding charter of the Society of Arts and Letters: who we are, how we decide, and how we carry on.', 'public', 'draft', 'Draft 1', null, '2026-10-13', null, 10,
   $doc$<p><strong>PREAMBLE</strong></p>
<p>We, students of the American University of Iraq – Baghdad, gathered as the Society of Arts and Letters, in a city that once kept the House of Wisdom and still keeps al-Mutanabbi Street, adopt this Constitution so that our Society is open to every student, governed in the open, careful with people and money, and built to outlast those who founded it.</p>
<p><strong>OUR MOTTO</strong></p>
<p lang="ar">والقرطاسُ والقلم</p>
<p>The paper and the pen</p>
<p>From al-Mutanabbi&#x27;s most quoted line: <em>the horses, the night and the desert know me; so do the sword, the lance, the paper and the pen.</em> We keep only the last two.</p>
<p><strong>OUR MISSION</strong></p>
<p>To cultivate a culture of literature and creative expression across AUIB.</p>
<p><strong>OUR FOUR PILLARS</strong></p>
<ul><li>Connecting students</li><li>Fostering creativity</li><li>Celebrating culture</li><li>Building a community</li></ul>
<h2>How to read this document</h2>
<p>The Constitution holds the rules that should rarely change: purpose, membership, who holds power, and how that power is checked. Everyday procedure lives in the Bylaws (SAL-GOV-02), role descriptions in the Roles &amp; Staffing Handbook (SAL-GOV-03), and conduct, money and media rules in the Policy Manual (SAL-POL-01).</p>
<h2>At a Glance</h2>
<p>The whole Constitution on one page, for members who will never read the other ten.</p>
<h4>Open and free</h4>
<p>Any enrolled AUIB student can join. No fee, no audition, no portfolio. Members who take part in two activities a semester vote.</p>
<h4>Members hold the power</h4>
<p>The General Assembly of all members elects the officers, changes this Constitution and can remove anyone who abuses a role.</p>
<h4>A Council runs the work</h4>
<p>Four elected officers and six appointed directors meet every two weeks, adopt the budget and greenlight programmes.</p>
<h4>Elections every April</h4>
<p>Secret ballot with AUIB sign-in, run by a committee of non-candidates. Ranked choice when more than two stand. Presidents serve two terms at most.</p>
<h4>Editors decide the art</h4>
<p>Programme editors and directors make creative calls. The Council overrules a selection only on grounds of law, safety or University policy, and in writing.</p>
<h4>Every dinar is logged</h4>
<p>Spending limits, two people on every cash count, receipts for everything, and charity money passed on in full.</p>
<h4>Fair process</h4>
<p>Anyone facing discipline hears the concern and can answer it. Removal of an officer needs two-thirds of members voting.</p>
<h4>Written to last</h4>
<p>Minutes, reports and an archive are kept for the next generation. Core principles can only be changed at two meetings, a month apart.</p>
<table><thead><tr><th>DECISION</th><th>WHO DECIDES</th><th>THRESHOLD</th></tr></thead><tbody><tr><td><strong>Amend the Constitution</strong></td><td>General Assembly</td><td>Two-thirds of votes cast, 14 days&#x27; notice</td></tr><tr><td><strong>Change the Bylaws or a Policy</strong></td><td>Council</td><td>Two-thirds of Council; members may overturn by majority</td></tr><tr><td><strong>Elect the officers</strong></td><td>Voting Members</td><td>Annual election in April</td></tr><tr><td><strong>Appoint the directors</strong></td><td>Executive Board, confirmed by Council</td><td>After an open call and interview</td></tr><tr><td><strong>Spend within the budget</strong></td><td>Director + Treasurer / President + Treasurer / Council</td><td>Up to 50,000 / 250,000 / above 250,000 IQD</td></tr></tbody></table>
<h2>The Articles</h2>
<h3>Article I · Name, Status and Symbols</h3>
<p><strong>1.1</strong> The name of the organisation is the <strong>Society of Arts and Letters</strong>, in Arabic <span lang="ar">جمعية الفنون والآداب</span>, known as <strong>SAL</strong> and in full as the AUIB Society of Arts and Letters (“the Society”).</p>
<p><strong>1.2</strong> The Society is a registered student organisation of the American University of Iraq – Baghdad (“the University”), recognised by the Office of Student Life. It follows the University’s policies; where this Constitution and University policy differ, University policy prevails.</p>
<p><strong>1.3</strong> The Society’s symbols are the Key monogram, the colours crimson, white and ink, and the motto <em>The paper and the pen</em> (<span lang="ar">والقرطاسُ والقلم</span>). The Society Typewriter is its ceremonial object and is held in the custody of the President.</p>
<p><strong>1.4</strong> English and Arabic are the languages of the Society and stand on equal footing in its work. This Constitution is authoritative in English; an Arabic summary is attached.</p>
<p><strong>1.5</strong> The Society was founded by Shaheen Farjo in [month, year]. This Constitution was adopted on Charter Day, October 13, 2026.</p>
<h3>Article II · Purpose</h3>
<p><strong>2.1</strong> The mission of the Society is to cultivate a culture of literature and creative expression across AUIB.</p>
<p><strong>2.2</strong> The Society pursues four pillars: connecting students, fostering creativity, celebrating culture, and building a community.</p>
<p><strong>2.3</strong> It does so through publishing, readings and salons, workshops, theatre, exhibitions, film and media, charitable programmes, and partnerships with other clubs, departments and cultural institutions.</p>
<p><strong>2.4</strong> The Society is non-partisan and non-sectarian. It does not campaign for any party, candidate or sect. Creative work presented by the Society may explore any human theme, within University policy and the law.</p>
<p><strong>2.5</strong> The Society is not for profit. Its funds serve its purpose only. No member receives payment or profit from Society funds, apart from reimbursement of approved expenses.</p>
<h3>Article III · Membership</h3>
<p><strong>3.1</strong> Membership is open to every enrolled student of the University. It is free, and requires no audition, portfolio or fee.</p>
<p><strong>3.2</strong> A student becomes a Member by completing the registration form and signing the Member Pledge.</p>
<p><strong>3.3</strong> The categories of membership are:</p>
<p>(a) <strong>Member</strong>: any registered student.</p>
<p>(b) <strong>Voting Member</strong>: a Member in good standing who has taken part in at least two Society activities in the current or previous semester, as recorded in the register.</p>
<p>(c) <strong>Fellow</strong>: a Member honoured by the Council for sustained or outstanding service.</p>
<p>(d) <strong>Honorary Member</strong>: a member of faculty, staff, an alumnus or a guest writer or artist, named by two-thirds of the Council. Honorary Members do not vote.</p>
<p>(e) <strong>Alumni Member</strong>: a former Member who has graduated. Alumni Members do not vote.</p>
<p><strong>3.4</strong> No one shall be excluded from membership, office or any activity of the Society on the grounds of gender, ethnicity, religion, sect, language, nationality, disability, college or year of study, or any other ground protected by University policy.</p>
<p><strong>3.5</strong> Every Member may attend Society activities, propose programmes, apply for any role, see the minutes and accounts, and raise a concern without fear of retaliation. Voting Members may vote and stand for office.</p>
<p><strong>3.6</strong> Every Member agrees to follow the Code of Conduct, to respect the work and consent of others, and to handle the Society’s property and money honestly.</p>
<p><strong>3.7</strong> Membership ends by written resignation, by graduation (when the Member becomes an Alumni Member), or by removal under Article XII.</p>
<h3>Article IV · Structure</h3>
<p><strong>4.1</strong> The Society acts through the General Assembly, the Council, the Faculty Advisor, its Programmes and its Committees.</p>
<p><strong>4.2</strong> All authority in the Society comes from the General Assembly of its Members.</p>
<h3>Article V · The General Assembly</h3>
<p><strong>5.1</strong> The General Assembly is made up of all Members. Only Voting Members may vote.</p>
<p><strong>5.2</strong> The General Assembly elects the officers, amends this Constitution, receives the Annual Report and accounts, may amend or overturn any Bylaw or Policy, may remove an officer, and may dissolve the Society.</p>
<p><strong>5.3</strong> The General Assembly meets at least once each semester. The Annual General Meeting is held in the spring. An Extraordinary General Assembly is called by the President, by a majority of the Council, or by a petition of one-tenth of Voting Members (and no fewer than ten), and meets within fourteen days of the petition.</p>
<p><strong>5.4</strong> Notice of a General Assembly, with its agenda, is sent to all Members at least seven days before it meets, and at least fourteen days before if an amendment to this Constitution is proposed.</p>
<p><strong>5.5</strong> The quorum is one-fifth of Voting Members or fifteen Voting Members, whichever is fewer.</p>
<p><strong>5.6</strong> Decisions are taken by a simple majority of votes cast, unless this Constitution says otherwise. Members may vote in person or through a secure online form that requires AUIB sign-in.</p>
<h3>Article VI · The Council</h3>
<p><strong>6.1</strong> The Council is made up of the Executive Board (the President, Vice President, General Secretary and Treasurer) and six Directors: of Letters; of Stage and Arts; of Programmes and Events; of Media; of Partnerships and Outreach; and of Membership and Community.</p>
<p><strong>6.2</strong> The Faculty Advisor, the Founding Advisor (Article VIII) and, when their programme is discussed, the Programme Chairs attend without a vote.</p>
<p><strong>6.3</strong> The Council runs the Society between General Assemblies. It adopts the budget, greenlights and closes programmes, appoints Programme Chairs, adopts Bylaws and Policies, and names Fellows and Honorary Members.</p>
<p><strong>6.4</strong> The Council meets at least every two weeks during term. Its quorum is a majority of its seated members, including the President or the Vice President. Decisions are taken by a majority of those voting; the chair has a casting vote in a tie.</p>
<p><strong>6.5</strong> Minutes and a log of decisions are made available to Members within seven days, except for confidential matters such as conduct cases and personal data.</p>
<p><strong>6.6</strong> While the Society is small, the Council may combine two Director roles in one person or leave one vacant, recording the reason in its minutes. No person holds more than one Council seat.</p>
<h3>Article VII · Officers and Directors</h3>
<p><strong>7.1 The President</strong> leads the Society, chairs the Council and the General Assembly, represents the Society to the University and beyond, serves ex officio as Publisher of the Society’s journal, and keeps the Society Typewriter.</p>
<p><strong>7.2 The Vice President</strong> deputises for the President, oversees the Directors’ work plans, and chairs the Conduct Panel.</p>
<p><strong>7.3 The General Secretary</strong> keeps the minutes, records, register and archive, conducts correspondence with the Office of Student Life, and administers elections.</p>
<p><strong>7.4 The Treasurer</strong> keeps the accounts, prepares the budget, enforces the rules on money, and reports on the finances to the Council each month and to the General Assembly each year.</p>
<p><strong>7.5 Directors</strong> lead the Society’s departments. They are appointed by the Executive Board after an open call and interview, and confirmed by the Council.</p>
<p><strong>7.6</strong> The term of office is one academic year, from the handover in May to the next. No person may serve more than two full terms as President.</p>
<p><strong>7.7</strong> Every officer and Director must be an enrolled student and a Voting Member. A candidate for President or Vice President must have been a Member for at least one semester and held a Society role for at least one semester. This requirement is waived for the founding term.</p>
<p><strong>7.8</strong> The full duties of each role are set out in the Roles &amp; Staffing Handbook.</p>
<h3>Article VIII · The Founder</h3>
<p><strong>8.1</strong> Shaheen Farjo is recognised as the Founder of the Society. The title is honorary and permanent.</p>
<p><strong>8.2</strong> For the founding term, from Charter Day until the new Council takes office after the first election in spring 2027, the Founder serves as President. The founding officers and Directors are appointed by the Founder and confirmed by the Founding General Assembly or by the Council.</p>
<p><strong>8.3</strong> After the founding term, the Founder holds office only if elected, like any Member. For one year after leaving office the Founder may attend the Council as Founding Advisor, without a vote, to support continuity.</p>
<h3>Article IX · The Faculty Advisor</h3>
<p><strong>9.1</strong> The Faculty Advisor is a full-time member of the University’s faculty or staff, invited by the Council and confirmed by the Office of Student Life, for a renewable term of one year.</p>
<p><strong>9.2</strong> The Faculty Advisor advises the Council, signs approvals where the University requires it, reviews the accounts each semester, and is a first point of contact on sensitive matters. The Faculty Advisor does not vote and does not direct creative or editorial decisions, except on grounds of safety, law or University policy.</p>
<h3>Article X · Programmes and Committees</h3>
<p><strong>10.1</strong> Programmes are the Society’s ongoing projects. Any Member may pitch one. The Council greenlights a programme with a named lead, a budget and a plan, set out in a Programme Charter.</p>
<p><strong>10.2</strong> A programme that runs successfully for two consecutive semesters may be declared a Standing Programme, with a Programme Chair and its own handbook. At the adoption of this Constitution the Standing Programmes are <em>Waraq</em> (the journal, working title), <em>Side Quest</em> (the video series, working title), <em>Second Chapter</em> (the charity book drive) and the <em>Typewriter Tour</em>.</p>
<p><strong>10.3</strong> Programme Chairs and editors make creative and editorial decisions within their charter. The Council does not overrule a selection except on grounds of law, safety or University policy, and records its reasons in writing.</p>
<p><strong>10.4</strong> The standing committees are the Elections Committee, the Conduct Panel and the Audit. The Council may form other committees, each with a written remit and an end date.</p>
<h3>Article XI · Elections</h3>
<p><strong>11.1</strong> Officers are elected each year by Voting Members in the spring election, run by an Elections Committee of three Voting Members who are not candidates. The Faculty Advisor observes.</p>
<p><strong>11.2</strong> Voting is by secret ballot. Each Voting Member has one vote per office, verified by AUIB sign-in.</p>
<p><strong>11.3</strong> Where more than two candidates stand, voting is by ranked choice. Where one candidate stands, members vote to elect the candidate or to re-open nominations.</p>
<p><strong>11.4</strong> If an office falls vacant, a by-election is held within four weeks of term, unless fewer than six weeks of the term remain, in which case the Council appoints an interim officer. A vacant Director role is filled by the Executive Board after an open call.</p>
<p><strong>11.5</strong> The detailed rules are set out in the Elections Code in the Bylaws.</p>
<h3>Article XII · Conduct, Discipline and Removal</h3>
<p><strong>12.1</strong> Every Member agrees to the Code of Conduct in the Policy Manual.</p>
<p><strong>12.2</strong> A concern may be raised with any officer, the Faculty Advisor or the Office of Student Life. It is handled confidentially and in proportion under the Complaints and Discipline Procedure, and the person concerned is told of it and may answer before any decision.</p>
<p><strong>12.3</strong> A Director may be removed by two-thirds of the Council after a hearing.</p>
<p><strong>12.4</strong> An officer may be removed by two-thirds of the votes cast at a General Assembly, on a motion supported by two-thirds of the Council or by a petition of one-fifth of Voting Members. The officer may address the Assembly before the vote.</p>
<p><strong>12.5</strong> The Council may declare vacant the seat of a member who misses three Council meetings in one semester without explanation.</p>
<p><strong>12.6</strong> Matters that may breach University rules or the law are referred to the Office of Student Life. The Society does not investigate them itself.</p>
<h3>Article XIII · Finance and Property</h3>
<p><strong>13.1</strong> The financial year follows the academic year. The Treasurer keeps the accounts. The Council adopts an annual budget and reports it to the General Assembly.</p>
<p><strong>13.2</strong> Within an approved budget, a Director may authorise spending up to 50,000 IQD with the Treasurer; spending up to 250,000 IQD requires the President and the Treasurer; spending above 250,000 IQD requires a vote of the Council. University funds follow the procedures of the Office of Student Life.</p>
<p><strong>13.3</strong> Cash is counted by two people, is never kept overnight by one student, and is recorded the same day. Every purchase has a receipt. Money raised for a charitable cause is passed in full to the named beneficiary; costs are paid separately.</p>
<p><strong>13.4</strong> Equipment, books, the archive, the Society Typewriter, and the Society’s name and brand belong to the Society, not to any individual, and are recorded in the inventory.</p>
<p><strong>13.5</strong> The accounts are reviewed each semester by the Faculty Advisor or the Audit, and a summary is shared with Members.</p>
<h3>Article XIV · Records and Transparency</h3>
<p><strong>14.1</strong> The General Secretary keeps the Constitution, Bylaws and Policies, the minutes and decisions log, the register of Members, correspondence, and the archive, including the Book of Members.</p>
<p><strong>14.2</strong> Any Member may see the non-confidential minutes, the budget and the accounts on request within seven days.</p>
<p><strong>14.3</strong> Personal data is handled under the Privacy Policy and seen only by those who need it.</p>
<p><strong>14.4</strong> The President presents an Annual Report at the Annual General Meeting.</p>
<h3>Article XV · Bylaws and Policies</h3>
<p><strong>15.1</strong> The Council may adopt Bylaws and Policies consistent with this Constitution by a two-thirds vote. They are reported to the next General Assembly, which may amend or overturn them by a simple majority.</p>
<p><strong>15.2</strong> Where documents conflict, this order prevails: University policy, this Constitution, the Bylaws, the Policies, then handbooks and guides.</p>
<h3>Article XVI · Amendments</h3>
<p><strong>16.1</strong> An amendment may be proposed by a majority of the Council or by a petition of one-tenth of Voting Members.</p>
<p><strong>16.2</strong> The text is sent to all Members at least fourteen days before the General Assembly that considers it.</p>
<p><strong>16.3</strong> An amendment is adopted by two-thirds of the votes cast at a quorate General Assembly.</p>
<p><strong>16.4</strong> Sections 1.1, 2.4, 3.1 and 3.4 (the name, non-partisanship, open and free membership, and non-discrimination) may be amended only by two General Assemblies at least thirty days apart.</p>
<p><strong>16.5</strong> An amendment takes effect once it is filed with the Office of Student Life, and approved where the University requires. The General Secretary updates the version record.</p>
<h3>Article XVII · Dissolution</h3>
<p><strong>17.1</strong> The Society may be dissolved by two-thirds of the votes cast at two General Assemblies at least thirty days apart.</p>
<p><strong>17.2</strong> On dissolution, debts are paid first. Remaining funds are used as the final General Assembly decides for a student arts or charitable purpose, within University rules. The archive, the books and the Society Typewriter pass to the University Library, so that the record remains.</p>
<h3>Article XVIII · Interpretation and Adoption</h3>
<p><strong>18.1</strong> The President rules on questions of interpretation, subject to the Council. A dispute that the Council cannot settle goes to the Faculty Advisor and, if needed, to the Office of Student Life.</p>
<p><strong>18.2</strong> This Constitution is adopted by the Founding Members at the Founding General Assembly on Charter Day and enters into force on adoption, subject to acknowledgement by the Office of Student Life.</p>
<p><strong>18.3</strong> For the Founding General Assembly only, the quorum is waived. Every Founding Member present signs the Founders’ Roll.</p>
<h2>The Founders’ Roll</h2>
<p>We, the Founding Members, adopt this Constitution on Charter Day, Tuesday, October 13, 2026, and sign our names to it. This page is kept in the archive for as long as the Society exists.</p>
<p>Continue on a second sheet if needed. Each Founding Member also types six words on the Society Typewriter; the page goes into the Book of Members.</p>
<h2>Adoption Record</h2>
<p>Completed by the General Secretary at the Founding General Assembly and after each amendment.</p>
<table><thead><tr><th>DATE ADOPTED</th><th>VENUE</th><th>FOUNDING MEMBERS PRESENT</th><th>VOTES FOR / AGAINST / ABSTAINING</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
<ul><li>Shaheen Farjo · Founder &amp; President</li><li>General Secretary</li><li>Faculty Advisor</li></ul>
<p><strong>Acknowledged by the Office of Student Life (name, date, reference)</strong></p>
<h4>Version record</h4>
<table><thead><tr><th>VERSION</th><th>DATE</th><th>CHANGE</th><th>APPROVED AT</th></tr></thead><tbody><tr><td><strong>1.0</strong></td><td>Oct 13, 2026</td><td>Constitution adopted</td><td>Founding General Assembly</td></tr></tbody></table>
<p><strong>Document</strong> SAL-GOV-01 · <strong>Version</strong> 1.0 (draft) · <strong>Owner</strong> General Secretary · <strong>Approved by</strong> General Assembly</p>
<p>Next review: every April, before the AGM. The current version always lives in <em>SAL Drive › 01 Governance</em>; printed copies may be out of date.</p>
$doc$),
  ('bylaws', 'SAL-GOV-02', 'Bylaws and Standing Orders', 'النظام الداخلي والقواعد الإجرائية', 'How the Society meets, votes, appoints, elects, spends and settles disputes, step by step.', 'public', 'draft', 'Draft 1', '2026-09-28', null, null, 20,
   $doc$<h2>Why Bylaws</h2>
<p>The Constitution says who holds power. The Bylaws say how that power is used on an ordinary Tuesday: how a meeting runs, how a vote is counted, how a new director is chosen and how a receipt becomes a reimbursement.</p>
<h4>1 · They make us predictable</h4>
<p>A new member should be able to read these pages and know exactly how a decision will be made, without asking who is in charge this year.</p>
<h4>2 · They protect the minority</h4>
<p>Notice periods, written reasons and a right to respond mean that the loudest voice in the room does not automatically win.</p>
<h4>3 · They carry the Society between generations</h4>
<p>Old literary societies survive for centuries because their procedures outlive their members. Columbia&#x27;s Philolexian Society has met since 1802 and UNC&#x27;s Dialectic Society since 1795; both still run on written rules.</p>
<h4>4 · They are easy to change</h4>
<p>Two-thirds of the Council can amend a Bylaw, and members can overturn any change by simple majority at the next General Assembly.</p>
<p><strong>Numbering.</strong> Bylaws are cited as B-section.clause, for example <em>B6.4</em> for the rule on uncontested elections. Forms are cited by their code in the Templates &amp; Forms Pack (SAL-OPS-02), for example <em>F-21</em>.</p>
<p><strong>Document</strong> SAL-GOV-02 · <strong>Version</strong> 1.0 (draft) · <strong>Owner</strong> General Secretary · <strong>Approved by</strong> Council (two-thirds)</p>
<p>Next review: each September, before the first General Assembly. The current version always lives in <em>SAL Drive › 01 Governance</em>; printed copies may be out of date.</p>
<h3>B1 · Meetings of the Council</h3>
<p><strong>1.1</strong> The Council meets at least every two weeks during term, at a regular time fixed at its first meeting of each semester. The Executive Board meets weekly, briefly, to prepare.</p>
<p><strong>1.2</strong> The General Secretary sends the agenda and papers at least 48 hours before each meeting. Any Council member may add an item up to 24 hours before.</p>
<p><strong>1.3</strong> The standing agenda is: apologies and conflicts of interest; minutes and actions of the last meeting; the Treasurer’s report; programmes, in order of urgency; decisions; any other business; date of next meeting.</p>
<p><strong>1.4</strong> Members declare any conflict of interest at the start. A member with a conflict may speak if invited but does not vote on that item.</p>
<p><strong>1.5</strong> Decisions are recorded in the Decisions Log with the date, the decision, the vote and the owner. Minutes are sent within 72 hours and approved at the next meeting.</p>
<p><strong>1.6</strong> Urgent decisions may be taken between meetings by a written vote in the Council’s group, open for at least 24 hours. A majority of all seated members must vote in favour. The result is recorded in the next minutes.</p>
<p><strong>1.7</strong> Members may join a meeting online. A member who cannot attend may send written comments but may not vote by proxy.</p>
<p><strong>1.8</strong> Items concerning individuals (conduct cases, personal circumstances, appointments) are taken in closed session and minuted separately.</p>
<h3>B2 · The General Assembly</h3>
<p><strong>2.1</strong> The General Assembly meets at least once each semester: an opening Assembly in the first month of the fall semester and the Annual General Meeting (AGM) in April.</p>
<p><strong>2.2</strong> The order of business at the AGM is: the President’s Annual Report; the Treasurer’s accounts; reports from Standing Programmes; motions; the declaration of the election results; the Ribbon; any other business.</p>
<p><strong>2.3</strong> Any Voting Member may submit a motion in writing (Form F-09) to the General Secretary at least five days before the Assembly, seconded by one other Voting Member.</p>
<p><strong>2.4</strong> Debate on a motion runs: proposer (three minutes), a speaker against if any (three minutes), open floor, a right of reply for the proposer (one minute), then the vote.</p>
<p><strong>2.5</strong> Amendments to a motion are taken before the motion itself. The chair may group similar amendments.</p>
<p><strong>2.6</strong> Any member may raise a point of order when they believe these rules are being broken. The chair rules at once; the ruling may be challenged and overturned by two-thirds of Voting Members present.</p>
<p><strong>2.7</strong> If the President wishes to speak for or against a motion, the Vice President chairs that item.</p>
<p><strong>2.8</strong> Votes are by show of hands, or by secure online form when requested by five members or when members attend online. Elections and removals are always by secret ballot.</p>
<h3>B3 · Membership and Good Standing</h3>
<p><strong>3.1</strong> The Director of Membership and Community keeps the register of Members (Form F-01), and the attendance record from which good standing is calculated.</p>
<p><strong>3.2</strong> An <strong>activity</strong> is any Society event, workshop, salon, rehearsal, meeting or volunteer shift where attendance is recorded on Form F-15 or by the event check-in.</p>
<p><strong>3.3</strong> A Member becomes a Voting Member on their second recorded activity in the current or previous semester. The register is frozen for each election on the day notice is given (B6.2).</p>
<p><strong>3.4</strong> A Member who has not taken part in any activity for two semesters is moved to the inactive list and invited back. They keep their membership but lose voting rights until they take part again.</p>
<p><strong>3.5</strong> Members may leave at any time by telling the Director of Membership. Their personal data is handled under the Privacy Policy.</p>
<h3>B4 · Recognition: Fellows and Honorary Members</h3>
<p><strong>4.1</strong> Any Council member may nominate a Member as a <strong>Fellow of the Society</strong> for at least forty hours of recorded service in an academic year, for leading a programme or an edition of one, or for exceptional work that raised the Society’s standing.</p>
<p><strong>4.2</strong> Fellows are confirmed by two-thirds of the Council, announced at the AGM, and receive a certificate and a page in the Book of Fellows. Fellowship is kept for life.</p>
<p><strong>4.3</strong> The number of new Fellows in a year should not exceed one-tenth of Voting Members, so that the honour keeps its value.</p>
<p><strong>4.4</strong> Honorary Membership may be conferred by two-thirds of the Council on faculty, staff, alumni or guest writers and artists who have given significant support. The General Secretary sends the invitation (Letter L-08).</p>
<p><strong>4.5</strong> Certificates of service (Form F-28) are issued to every officer, director, programme lead and coordinator who completes a term, signed by the President and the Faculty Advisor.</p>
<h3>B5 · Appointments and the Apprenticeship</h3>
<p><strong>5.1</strong> The Society runs an <strong>Open Call</strong> at the start of each semester for every open role. Roles are advertised with their role card from the Roles &amp; Staffing Handbook, the time needed and the closing date.</p>
<p><strong>5.2</strong> Applicants complete Form F-03. Director and Programme Chair applicants also have a fifteen-minute interview with a panel of three: two members of the Executive Board and one person from the relevant department or programme.</p>
<p><strong>5.3</strong> The panel scores each applicant independently on Form F-04, then agrees a decision. Applicants hear within five days of their interview. Unsuccessful applicants are offered a coordinator or team role where one fits.</p>
<p><strong>5.4</strong> Team roles below director level begin with a three-week <strong>Apprenticeship</strong>: one small real task with a mentor. At the end, the apprentice and the director agree whether to continue. Inspired by the Harvard Advocate’s “comp”, but shorter and never competitive between friends.</p>
<p><strong>5.5</strong> No person holds more than two Society roles at once, and no more than one leadership role (officer, director or programme chair), except in the founding term with the Council’s agreement.</p>
<p><strong>5.6</strong> Panel members declare friendships or other conflicts and step aside where needed.</p>
<p><strong>5.7</strong> Appointments are confirmed by the Council at its next meeting and announced on the Society’s channels.</p>
<h3>B6 · The Elections Code</h3>
<p><strong>6.1</strong> The Council appoints the Elections Committee of three Voting Members who will not stand, by mid-March. The Committee chooses its chair. The General Secretary supports it unless standing, in which case the Committee chair takes over all election administration.</p>
<p><strong>6.2</strong> The Committee gives notice of the election at least one week before nominations open, listing the offices, the eligibility rules and the timetable. The voter list is the register of Voting Members on that day.</p>
<p><strong>6.3</strong> Nominations stay open for one week. Each candidate submits Form F-21 with the names of two Voting Members who second them, a statement of up to 200 words, and a six-word vision.</p>
<p><strong>6.4</strong> Where one candidate stands for an office, members vote to elect that candidate or to re-open nominations (RON). If RON wins, nominations re-open for one week.</p>
<p><strong>6.5</strong> Candidates present themselves at <strong>the Candidates’ Reading</strong>, a public hustings: each reads the six-word vision, speaks for three minutes and answers questions from members for up to ten minutes.</p>
<p><strong>6.6</strong> Campaigning rules:</p>
<p>(a) Campaigning runs from the close of nominations to the opening of voting only.</p>
<p>(b) Candidates may use personal channels and up to ten printed posters. The Society’s channels carry one equal post per candidate, made by the Committee.</p>
<p>(c) No gifts, food or favours in exchange for votes; no pressure on anyone to show how they voted.</p>
<p>(d) Candidates may not use a current office, Society property or member data to campaign.</p>
<p>(e) Campaigning is about ideas. Personal attacks, or campaigning on sect, ethnicity or party, lead to disqualification.</p>
<p><strong>6.7</strong> Voting is online for 48 hours through a form restricted to AUIB accounts and to one response per person, checked against the voter list. The Committee may also offer a paper ballot box with the register at a staffed table.</p>
<p><strong>6.8</strong> Where more than two candidates stand, members rank them. If no candidate has more than half of the first preferences, the last candidate is removed and their votes pass to each ballot’s next preference, until one candidate has a majority.</p>
<p><strong>6.9</strong> A tie is broken by a second vote between the tied candidates within three days; if still tied, by lot drawn at a public meeting.</p>
<p><strong>6.10</strong> Complaints about the election go in writing to the Committee within 24 hours of the conduct or of the results. The Committee decides within 48 hours. Its decision may be appealed once to the Faculty Advisor, whose decision is final.</p>
<p><strong>6.11</strong> The Committee declares the results with the vote counts at each round (Form F-23). Ballot data is kept for one year, then deleted.</p>
<p><strong>6.12</strong> Elected officers shadow the outgoing officers from the AGM until the handover date, and together with them appoint the incoming directors through an open call (B5).</p>
<h3>B7 · Committees</h3>
<p><strong>7.1 The Conduct Panel</strong> hears conduct cases. It is chaired by the Vice President, with one other Council member and one Voting Member drawn by lot from a list of volunteers each semester. The Faculty Advisor may advise. Any member of the Panel with a conflict is replaced.</p>
<p><strong>7.2 The Audit</strong> is the Faculty Advisor, or a Voting Member not on the Council whom the Faculty Advisor chooses, who checks the ledger against receipts each semester and reports to the Council and the General Assembly.</p>
<p><strong>7.3 The Elections Committee</strong> is formed each spring under B6 and dissolves once the results are final.</p>
<p><strong>7.4</strong> The Council may create other committees or working groups by resolution, with a remit, a chair, members and an end date. Committees report in writing.</p>
<h3>B8 · Programmes and Programme Charters</h3>
<p><strong>8.1</strong> Any Member may pitch a programme on Form F-10 to the relevant Director, who brings it to the Council within two meetings.</p>
<p><strong>8.2</strong> The Council greenlights a programme when it has: a named lead, a clear purpose linked to a pillar, a dated plan, a budget, a risk check (Form F-11 for events), and no clash with the calendar. The decision and the reasons are recorded.</p>
<p><strong>8.3</strong> A greenlit programme has a <strong>Programme Charter</strong>: one page setting out its purpose, lead, team, reporting line, budget, key dates, success measures and the date it will be reviewed.</p>
<p><strong>8.4</strong> Each edition of a programme ends with a report (Form F-25 section B) within three weeks, which goes to the Council and the archive.</p>
<p><strong>8.5</strong> A programme that has run successfully for two consecutive semesters may be declared a Standing Programme by the Council, with a Programme Chair and its own handbook.</p>
<p><strong>8.6</strong> A programme that has not run for two semesters lapses. Its files go to the archive; it may be revived by a new pitch.</p>
<p><strong>8.7</strong> Editorial independence (Constitution 10.3): if the Council has concerns about a selection or content, the President raises them with the Programme Chair first. The Council may only overrule on grounds of law, safety or University policy, by majority, with written reasons shared with the Chair.</p>
<h3>B9 · Money</h3>
<p><strong>9.1</strong> In the second week of each semester, the Treasurer drafts the semester budget from the Directors’ requests (Form F-12). The Council adopts it by the fourth week.</p>
<p><strong>9.2</strong> Spending authority follows Constitution 13.2: up to 50,000 IQD by a Director with the Treasurer; up to 250,000 IQD by the President and the Treasurer; above that by a vote of the Council. Nobody approves a payment to themselves.</p>
<p><strong>9.3</strong> Every purchase has a receipt, photographed and uploaded to the finance folder within 48 hours. Members claim reimbursement on Form F-13 within 30 days; the Treasurer pays or refers within 14 days.</p>
<p><strong>9.4</strong> Cash is counted by two people, recorded on Form F-14 and signed by both. It is never kept overnight by one student: it is handed to the Office of Student Life or its agreed safe, the same day.</p>
<p><strong>9.5</strong> The Treasurer keeps the ledger in the Operations Tracker and reports balances and spending against budget at every other Council meeting.</p>
<p><strong>9.6</strong> Sponsorship and donations are accepted only under the Partnerships Policy, recorded in the ledger and acknowledged in writing.</p>
<p><strong>9.7</strong> Money raised for a charitable cause is held separately, never used for costs, and handed to the beneficiary in a witnessed handover with a signed receipt.</p>
<p><strong>9.8</strong> The Treasurer and the President may not be the same person, nor close relatives, nor share a household.</p>
<h3>B10 · Complaints and Discipline</h3>
<p><strong>10.1</strong> Anyone may raise a concern about conduct with any officer, the Faculty Advisor or Student Life, in person or on Form F-20. Concerns about the Vice President go to the President; concerns about the President go to the Vice President and the Faculty Advisor.</p>
<p><strong>10.2</strong> The concern is acknowledged within three days. Most concerns are settled informally: a conversation, an apology, a clarification. The person raising it chooses whether to go further.</p>
<p><strong>10.3</strong> A formal case is heard by the Conduct Panel. The member concerned receives the concern in writing, at least five days to respond, and the right to bring a supporter who is an AUIB student or staff member.</p>
<p><strong>10.4</strong> Outcomes, in proportion to the conduct: no action; guidance; a written warning; removal from a role; suspension from activities for a stated period; removal of membership (which requires two-thirds of the Council).</p>
<p><strong>10.5</strong> Where there is a risk to anyone’s safety, the President and the Vice President may suspend a member from activities at once, pending the case, and inform the Faculty Advisor.</p>
<p><strong>10.6</strong> Decisions are given in writing with reasons within 14 days of the hearing. An appeal may be made once, within seven days, to the Faculty Advisor and one officer not involved.</p>
<p><strong>10.7</strong> Anything that may involve a crime, harassment under University policy or a risk to a child is referred straight to Student Life. The Society does not investigate it.</p>
<p><strong>10.8</strong> Case records are confidential, kept by the General Secretary in a restricted folder and deleted two years after the case closes.</p>
<h3>B11 · Handover and Continuity</h3>
<p><strong>11.1</strong> Every officer, director and programme chair keeps a <strong>handover dossier</strong> during their term (Form F-24): contacts, passwords held (not the passwords themselves), calendar, open items, lessons and files.</p>
<p><strong>11.2</strong> Incoming officers shadow outgoing officers between the AGM and the handover date. The outgoing officer stays available for questions for one month after.</p>
<p><strong>11.3</strong> Access to accounts, drives and groups is transferred within seven days of handover and removed from anyone who has left a role. Every account has at least two administrators on the Council.</p>
<p><strong>11.4</strong> The Ribbon: at the AGM, the outgoing President hands the incoming President a new ribbon for the Society Typewriter. The Society’s first act of each year is a new page typed by the incoming Council.</p>
<h3>B12 · Records, Channels and Amendment</h3>
<p><strong>12.1</strong> The official channels are the Society’s Instagram (@auibsal), its Telegram channel (The Common Room), its AUIB email address and the all-student email sent through Student Life. The President or a person they name speaks for the Society in public.</p>
<p><strong>12.2</strong> Files are kept in the Society Drive under the structure in the Operations Playbook, named <em>SAL_Area_Document_YYYY-MM-DD</em>.</p>
<p><strong>12.3</strong> These Bylaws may be amended by two-thirds of the Council. Changes are published to members within seven days and reported to the next General Assembly, which may overturn them by simple majority.</p>
<p><strong>12.4</strong> Any Bylaw that conflicts with the Constitution or University policy has no effect.</p>
<h2>Election Season</h2>
<p>The first election under this Constitution, spring 2027. Dates move with the academic calendar but the order and the gaps stay the same, and everything must finish before final exams.</p>
<p><strong>Sun, Mar 14, 2027</strong></p>
<p>Elections Committee appointed</p>
<p><strong>Sun, Mar 28</strong></p>
<p>Notice of election and the list of offices</p>
<p><strong>Sun, Apr 4 – Sun, Apr 11</strong></p>
<p>Nominations open</p>
<p><strong>Tue, Apr 13</strong></p>
<p>The Candidates’ Reading (hustings)</p>
<p><strong>Wed, Apr 14 – Thu, Apr 15</strong></p>
<p>Voting, 48 hours online with AUIB sign-in</p>
<p><strong>Thu, Apr 15</strong></p>
<p>Results declared</p>
<p><strong>Tue, Apr 20</strong></p>
<p>Annual General Meeting and the Ribbon (handover ceremony)</p>
<p><strong>Apr 20 – May 13</strong></p>
<p>Shadow period; incoming officers appoint directors</p>
<p><strong>Thu, May 13</strong></p>
<p>New Council takes office</p>
<h4>Offices elected</h4>
<p>President, Vice President, General Secretary and Treasurer. Directors are then appointed by open call.</p>
<h4>Who can vote</h4>
<p>Every Voting Member on the register the day notice is given: two recorded activities in the current or previous semester.</p>
<h4>Who can stand</h4>
<p>Any Voting Member. For President and Vice President: one semester as a member and one semester in a Society role.</p>
<h2>The Ribbon</h2>
<p>At the AGM the outgoing President hands on a fresh ribbon for the Society Typewriter, and the new Council types the first page of its year. It takes two minutes, and it makes the handover something people remember.</p>
<h2>Counting Ranked Votes</h2>
<p>A worked example, so the Elections Committee can count with confidence and every candidate can check the result.</p>
<table><thead><tr><th>ROUND</th><th>A</th><th>B</th><th>C</th><th>WHAT HAPPENS</th></tr></thead><tbody><tr><td><strong>1</strong></td><td>42</td><td>38</td><td>20</td><td>100 ballots; 51 needed. No majority, so C (fewest) is removed.</td></tr><tr><td><strong>2</strong></td><td>48 (+6)</td><td>52 (+14)</td><td>–</td><td>C&#x27;s 20 ballots move to their second choice. B passes 51 and is elected.</td></tr></tbody></table>
<h4>The steps</h4>
<ul><li>Export the responses; remove any that do not match the voter list or repeat a voter</li><li>Count first preferences for each candidate</li><li>If someone has more than half, they win</li><li>If not, remove the last-placed candidate and move each of their ballots to its next ranked candidate still in the race</li><li>Repeat until one candidate has more than half of the ballots still active</li><li>Record every round on Form F-23</li></ul>
<h4>Good practice</h4>
<ul><li>Two Committee members count independently; the third checks</li><li>Candidates may watch the count or send one observer</li><li>Ballots that rank nobody still in the race are set aside as exhausted and reported</li><li>A spreadsheet in the Operations Tracker does the arithmetic; the Committee still checks by hand</li><li>Publish the rounds, not just the winner</li></ul>
$doc$),
  ('roles-and-staffing', 'SAL-GOV-03', 'Roles and Staffing', 'الأدوار والملاك', 'Who does what in the Society of Arts and Letters, how many people we need, and how we grow.', 'public', 'draft', 'Draft 1', '2026-09-28', null, null, 30,
   $doc$<h2>How SAL Is Organised</h2>
<p>Four layers, each with a clear job. Members hold the power, the Council runs the work, departments carry it out, and programmes are where the art happens.</p>
<h4>1 · The General Assembly</h4>
<p>Every member. Meets at least once a semester. Elects the four officers, changes the Constitution, receives the accounts and can remove anyone who abuses a role.</p>
<h4>2 · The Council</h4>
<p>Four elected officers (the Executive Board) and six appointed directors. Meets every two weeks, adopts the budget, greenlights programmes, makes the Bylaws and Policies.</p>
<h4>3 · Six departments</h4>
<p>Letters · Stage &amp; Arts · Programmes &amp; Events · Media · Partnerships &amp; Outreach · Membership &amp; Community. Each director leads a small team of coordinators.</p>
<h4>4 · Programmes</h4>
<p>The things people see: Waraq, Side Quest, Second Chapter, the Typewriter Tour, the Majlis and more. Each has a lead, a charter and a budget, and the big ones have their own handbook.</p>
<h4>Borrowed from Oxford and Dublin</h4>
<p>A small elected council with named officers, as in Trinity College Dublin’s Phil, which elects nine officers and co-opts more.</p>
<h4>Borrowed from Harvard</h4>
<p>Boards by craft (fiction, poetry, art, design, business) and a trial period before joining, like the Advocate’s comp.</p>
<h4>Borrowed from Baghdad</h4>
<p>The salon, where writers and readers meet as equals over tea. SAL’s Majlis is the heart of the Letters department.</p>
<h2>The Organisation Chart</h2>
<p>The full structure at scale. In the founding term some boxes are combined (dashed), as the Constitution allows.</p>
<ul>
<li><strong>General Assembly</strong>: all members</li>
<li><strong>Faculty Advisor</strong>: advises · signs</li>
<li><strong>President</strong>: chairs the Council</li>
<li><strong>Founder</strong>: honorary</li>
<li><strong>Vice President</strong>: directors · conduct</li>
<li><strong>General Secretary</strong>: records · Student Life</li>
<li><strong>Treasurer</strong>: budget · ledger</li>
</ul>
<h4>Departments</h4>
<ul>
<li><strong>Letters</strong>: Majlis · Open Pages · Book Circle · Prizes</li>
<li><strong>Stage &amp; Arts</strong>: Scratch Night · Theatre · Gallery</li>
<li><strong>Programmes &amp; Events</strong>: Calendar · Venues · Volunteers</li>
<li><strong>Media</strong>: Social · Design · Photo &amp; Video</li>
<li><strong>Partnerships</strong>: Clubs · Charities · Sponsors</li>
<li><strong>Membership</strong>: Welcome · Records · Alumni</li>
</ul>
<h4>Programmes, each with a chair and a charter</h4>
<ul>
<li><strong>Waraq</strong>: journal · via the Publisher</li>
<li><strong>Side Quest</strong>: series · via Media</li>
<li><strong>Second Chapter</strong>: charity · via Partnerships</li>
<li><strong>Typewriter Tour</strong>: pop-up · via Letters</li>
<li><strong>New programmes</strong>: pitched by any member</li>
</ul>
<h4>Committees</h4>
<ul>
<li><strong>Elections Committee</strong>: each spring</li>
<li><strong>Conduct Panel</strong>: VP + 2</li>
<li><strong>Audit</strong>: each semester</li>
</ul>
<h2>Growing in Stages</h2>
<p>We staff for the Society we are, not the one we hope to be. Each stage adds roles only when the work and the people are there.</p>
<table><thead><tr><th>STAGE</th><th>MEMBERS</th><th>COUNCIL</th><th>OTHER ROLES</th><th>ROLES</th></tr></thead><tbody><tr><td><strong>1 · Founding 2026–27</strong></td><td>Up to ~40 registered</td><td>8 seats: four officers + Letters (also Stage &amp; Arts), Programmes, Media, Membership. The VP covers Partnerships.</td><td>4 programme chairs; 6–8 coordinators (Social Media, Design, Onboarding, Event Coordinator, Archivist, Majlis Host); programme teams</td><td>~18 + programme teams</td></tr><tr><td><strong>2 · Growing 2027–28</strong></td><td>40–100</td><td>All 10 seats filled</td><td>~14 coordinators; Scratch Night and a one-act festival; Alumni Lead</td><td>~28</td></tr><tr><td><strong>3 · Established</strong></td><td>100+</td><td>10 seats + deputies for the Treasurer and General</td><td>~20 coordinators; Sponsorship Lead; inter-university links</td><td>~35</td></tr><tr><td><strong>2028 onward</strong></td><td></td><td>Secretary</td><td></td><td></td></tr></tbody></table>
<h4>Move up a stage when…</h4>
<p>Voting Members pass the next band for a full semester, and every existing seat has been filled for that semester.</p>
<h4>Hold back when…</h4>
<p>Seats sit empty, deadlines slip, or the same five people do everything. Fill and train before adding.</p>
<h4>Who decides</h4>
<p>The Council, at the start of each semester, recorded in the minutes. Stages are a guide, not a rule.</p>
<h2>The smallest working Society</h2>
<p>If people are scarce, these six must be filled first: President, Vice President, Treasurer, General Secretary, Media Director and Director of Programmes. Everything else can be covered for a semester.</p>
<h2>Who’s Who</h2>
<p>The founding term, as far as we know it on September 28, 2026. Fill the brackets before Charter Day; the live version is the Roster tab in the Operations Tracker.</p>
<table><thead><tr><th>ROLE</th><th>HOLDER</th><th>NOTE</th></tr></thead><tbody><tr><td><strong>Founder</strong></td><td><strong>Shaheen Farjo</strong></td><td>Honorary, permanent</td></tr><tr><td><strong>President</strong></td><td><strong>Shaheen Farjo</strong></td><td>Founding term, to May 2027</td></tr><tr><td><strong>Vice President</strong></td><td><em>[name]</em></td><td>Founder appoints; confirmed on Charter Day</td></tr><tr><td><strong>General Secretary</strong></td><td><em>[name]</em></td><td>Founder appoints; confirmed on Charter Day</td></tr><tr><td><strong>Treasurer</strong></td><td><em>[name]</em></td><td>Founder appoints; confirmed on Charter Day</td></tr><tr><td><strong>Director of Letters</strong></td><td><em>Open</em></td><td>Open Call Oct 18; also covers Stage &amp; Arts</td></tr><tr><td><strong>Director of Programmes &amp; Events</strong></td><td><em>Open</em></td><td>Open Call Oct 18</td></tr><tr><td><strong>Media Director</strong></td><td><strong>Ali Hayder</strong></td><td>Confirmed on Charter Day</td></tr><tr><td><strong>Director of Membership &amp; Community</strong></td><td><em>Open</em></td><td>Open Call Oct 18</td></tr><tr><td><strong>Director of Partnerships &amp; Outreach</strong></td><td><em>Covered by the VP</em></td><td>Recruit in spring or Year 2</td></tr><tr><td><strong>Director of Stage &amp; Arts</strong></td><td><em>Covered by Letters</em></td><td>Recruit in Year 2</td></tr><tr><td><strong>Faculty Advisor</strong></td><td><em>[name]</em></td><td>Invitation out; confirm by Oct 8</td></tr><tr><td><strong>Waraq Editor-in-Chief</strong></td><td><em>[name]</em></td><td>Appointed by the Publisher for Issue 1</td></tr><tr><td><strong>Side Quest Creative Director</strong></td><td><strong>Ali Hayder</strong></td><td>With Hassan Sadiq as host</td></tr><tr><td><strong>Side Quest Host</strong></td><td><strong>Hassan Sadiq</strong></td><td>Programme talent, Media department</td></tr><tr><td><strong>Second Chapter Lead</strong></td><td><strong>Shaheen Farjo</strong></td><td>Edition 1; hand on for Edition 2</td></tr><tr><td><strong>Typewriter Tour Lead</strong></td><td><em>Open</em></td><td>Spring 2027</td></tr></tbody></table>
<h2>Staffing Principles</h2>
<h4>1 · Two roles at most, one leadership role</h4>
<p>Nobody holds more than two Society roles, and only one of them may be officer, director or programme chair (B5.5). The founding term is the only exception.</p>
<h4>2 · Every role has a backup</h4>
<p>Each role card names a deputy. If you are ill during an event week, the work still happens.</p>
<h4>3 · Honest hours</h4>
<p>Each role says how many hours it needs. Applicants tell us their other commitments. We would rather fill a role late than burn someone out.</p>
<h4>4 · Open doors, fair choices</h4>
<p>Every role is advertised in the Open Call to every student, SAL member or not, and chosen by a panel with a score sheet.</p>
<h4>5 · Try before you commit</h4>
<p>Team roles start with a three-week Apprenticeship: one real task with a mentor, then a free choice on both sides.</p>
<h4>6 · Write it down, hand it on</h4>
<p>Every role keeps a handover dossier from its first week, not its last.</p>
<h4>7 · Credit is part of the job</h4>
<p>Names in programmes and mastheads, certificates of service, and Fellowships for those who give the most.</p>
<p><strong>Key-person risk, founding term.</strong> Today the Founder is President, Publisher of Waraq, Executive Producer of Side Quest and Lead of Second Chapter, and the Media Director is also Side Quest’s Creative Director. That is allowed for the founding term, but it is the Society’s biggest risk. <strong>Recommended:</strong> appoint a Second Chapter deputy by October 31 who leads Edition 2; recruit a Social Media Lead and a Design Lead in the Open Call so Media runs during Side Quest shoots; and name the Vice President as President-in-waiting for every Student Life contact.</p>
<h2>The Executive Board</h2>
<p>The four elected officers. Together they prepare every Council meeting and carry the Society between them.</p>
<h3>President</h3>
<p>Elected</p>
<p><strong>Reports to</strong> General Assembly</p>
<p><strong>Backup</strong> Vice President</p>
<p><strong>Time</strong> 8–10 h/week</p>
<p><strong>Term</strong> One year; two terms max</p>
<p>Leads the Society, keeps it true to its mission, and makes sure the right people have what they need to do their work.</p>
<h4>Responsibilities</h4>
<ul><li>Chairs the Council and the General Assembly; sets the agenda with the General Secretary</li><li>Represents SAL to the Office of Student Life, faculty and partners; signs letters and agreements</li><li>Holds each officer and director to their work plan through a monthly one-to-one</li><li>Serves ex officio as Publisher of Waraq: approvals, budget, editorial independence</li><li>Approves spending up to 250,000 IQD with the Treasurer</li><li>Keeps the Society Typewriter; opens Charter Night and the AGM</li><li>Writes the Annual Report and leads the handover to the next President</li></ul>
<h4>Decides</h4>
<ul><li>Council agenda and meeting chair rulings</li><li>Who speaks for SAL in public</li><li>Emergency suspension (with the VP) where safety is at risk</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Every Council seat filled or covered</li><li>Every programme has a charter and a lead</li><li>Annual Report delivered at the AGM</li><li>A successor ready: at least two credible candidates</li></ul>
<h4>Hands on</h4>
<ul><li>Student Life contacts and open requests</li><li>Partner agreements and their renewal dates</li><li>The Society Typewriter and its ribbon</li></ul>
<p><strong>Founding term:</strong> Shaheen Farjo (Founder; founding term)</p>
<h3>Vice President</h3>
<p>Elected</p>
<p><strong>Reports to</strong> President</p>
<p><strong>Backup</strong> General Secretary</p>
<p><strong>Time</strong> 5–6 h/week</p>
<p><strong>Term</strong> One year</p>
<p>The Society’s second engine: runs the directors day to day, keeps projects on schedule, and chairs the Conduct Panel so that fairness has an owner.</p>
<h4>Responsibilities</h4>
<ul><li>Acts for the President when absent and chairs items the President speaks on</li><li>Collects each director’s semester work plan and checks progress every two weeks</li><li>Chairs the Conduct Panel; keeps concerns confidential and on time</li><li>Leads the Open Call and the appointment panels with the President</li><li>Owns the semester calendar and resolves clashes between programmes</li><li>Covers Partnerships &amp; Outreach while that seat is vacant in the founding term</li></ul>
<h4>Decides</h4>
<ul><li>Programme calendar clashes</li><li>Conduct Panel procedure (with the Panel)</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Directors’ work plans in by week 3</li><li>90% of dated actions done on time</li><li>Conduct cases closed within 14 days of hearing</li></ul>
<h4>Hands on</h4>
<ul><li>Calendar, work plans and progress log</li><li>Open conduct matters (restricted)</li></ul>
<p><strong>Founding term:</strong> To be appointed by Charter Day</p>
<h3>General Secretary</h3>
<p>Elected</p>
<p><strong>Reports to</strong> President</p>
<p><strong>Backup</strong> Vice President</p>
<p><strong>Time</strong> 4–5 h/week</p>
<p><strong>Term</strong> One year</p>
<p>The memory of the Society: minutes, records, the register, the archive, and every letter to the University.</p>
<h4>Responsibilities</h4>
<ul><li>Sends agendas 48 hours before and minutes within 72 hours; keeps the Decisions Log</li><li>Single point of contact for the Office of Student Life: room bookings, approvals, all-student emails</li><li>Keeps the Constitution, Bylaws and Policies current, with version records</li><li>Runs election administration unless standing; supports the Elections Committee</li><li>Keeps the archive and the Book of Members with the Archivist</li><li>Holds the Society Drive structure and access permissions with the Media Director</li></ul>
<h4>Decides</h4>
<ul><li>Drive structure and file naming</li><li>What is archived permanently</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Minutes out within 72 hours, every time</li><li>Every Student Life request filed on the lead times in the Playbook</li><li>Archive complete for each semester</li></ul>
<h4>Hands on</h4>
<ul><li>Drive admin rights</li><li>Register and archive</li><li>Student Life request log</li></ul>
<p><strong>Founding term:</strong> To be appointed by Charter Day</p>
<h3>Treasurer</h3>
<p>Elected</p>
<p><strong>Reports to</strong> President and Council</p>
<p><strong>Backup</strong> President (Deputy Treasurer from Stage 3)</p>
<p><strong>Time</strong> 3–4 h/week; more in event weeks</p>
<p><strong>Term</strong> One year</p>
<p>Keeps every dinar honest and visible, so that the University, partners and members can trust the Society with money.</p>
<h4>Responsibilities</h4>
<ul><li>Drafts the semester budget from directors’ requests; brings it to Council by week 4</li><li>Keeps the ledger in the Operations Tracker; files every receipt within 48 hours</li><li>Co-approves spending up to 50,000 IQD with directors, and up to 250,000 IQD with the President</li><li>Trains cashiers and enforces the two-person cash rule at every event</li><li>Pays reimbursements within 14 days of a complete claim</li><li>Reports to Council every other meeting and to the AGM each year; prepares the Audit</li></ul>
<h4>Decides</h4>
<ul><li>Whether a claim is complete</li><li>Cash procedure at events</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Ledger matches receipts at the Audit</li><li>Spending within 10% of budget</li><li>Charity handovers witnessed and receipted</li></ul>
<h4>Hands on</h4>
<ul><li>Ledger and receipts folder</li><li>Cash box, float log and keys</li><li>Open claims and pledges</li></ul>
<p><strong>Founding term:</strong> To be appointed by Charter Day</p>
<h2>The Directors</h2>
<p>Six appointed directors, each leading a department and a small team of coordinators.</p>
<h3>Director of Letters</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> Vice President</p>
<p><strong>Backup</strong> A coordinator named each semester</p>
<p><strong>Time</strong> 4–6 h/week</p>
<p><strong>Term</strong> One year</p>
<p>Keeps reading and writing at the heart of the Society: the salon, the workshops, the book circle and the prizes.</p>
<h4>Responsibilities</h4>
<ul><li>Runs the Majlis (monthly salon), Open Pages (writing workshops) and the Book Circle, through their hosts</li><li>Liaises with Waraq’s Editor-in-Chief; the journal stays editorially independent</li><li>Designs the SAL Prizes for writing in Arabic and English (from Year 2)</li><li>Invites guest writers with the Director of Partnerships</li><li>Keeps the Society’s reading list and book-swap shelf</li><li>Covers Stage &amp; Arts while that seat is vacant in the founding term</li></ul>
<h4>Decides</h4>
<ul><li>Salon and workshop themes and guests (within budget)</li><li>Book Circle titles, alternating Arabic and English</li></ul>
<h4>Doing well looks like</h4>
<ul><li>One Majlis a month in term</li><li>Two Open Pages workshops a semester</li><li>Average attendance rising semester on semester</li></ul>
<h4>Hands on</h4>
<ul><li>Guest writer contacts</li><li>Reading list and shelf inventory</li></ul>
<p><strong>Founding term:</strong> Open · SAL Open Call, Oct 18</p>
<h3>Director of Stage &amp; Arts</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> Vice President</p>
<p><strong>Backup</strong> Stage Manager</p>
<p><strong>Time</strong> 4–6 h/week; more in production weeks</p>
<p><strong>Term</strong> One year</p>
<p>Builds SAL’s theatre and visual arts, step by step, from a first staged reading to a full production.</p>
<h4>Responsibilities</h4>
<ul><li>Runs Scratch Night: an informal showcase where anyone tries a scene, poem or sketch</li><li>Leads the theatre ladder: staged readings, then a one-act festival, then a full production</li><li>Curates the Gallery Wall of student art and photography</li><li>Works with the Director of Programmes on venues, rehearsal rooms and technical needs</li><li>Keeps rights clear: permission for any published play, credit for every artist</li></ul>
<h4>Decides</h4>
<ul><li>Casting (with each director of a piece)</li><li>Gallery selection</li></ul>
<h4>Doing well looks like</h4>
<ul><li>One Scratch Night a semester</li><li>First one-act festival in Year 2</li><li>Every performance has a stage manager and a risk check</li></ul>
<h4>Hands on</h4>
<ul><li>Scripts and rights file</li><li>Props and costume inventory</li></ul>
<p><strong>Founding term:</strong> Covered by the Director of Letters in the founding term</p>
<h3>Director of Programmes &amp; Events</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> Vice President</p>
<p><strong>Backup</strong> Event Coordinator</p>
<p><strong>Time</strong> 5–6 h/week</p>
<p><strong>Term</strong> One year</p>
<p>Turns ideas into events that happen on time, safely, in the right room, with the right approvals.</p>
<h4>Responsibilities</h4>
<ul><li>Keeps the events calendar and the Term Card; checks every event against exams and other clubs</li><li>Runs the event process in the Playbook: proposal, approvals, rooms, run sheet, debrief</li><li>Books rooms and equipment through the General Secretary and Student Life</li><li>Leads the volunteer rota and briefings with the Director of Membership</li><li>Owns the risk check (Form F-11) for every event over 30 people</li><li>Runs Charter Night each October and the AGM logistics each April</li></ul>
<h4>Decides</h4>
<ul><li>Run sheets and on-the-day decisions (safety first)</li><li>Whether an event is ready to go ahead at the T– 7 check</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Every event filed on the Playbook lead times</li><li>A debrief within three days of each event</li><li>No event cancelled for missing approvals</li></ul>
<h4>Hands on</h4>
<ul><li>Venue contacts and booking log</li><li>Event kit inventory</li></ul>
<p><strong>Founding term:</strong> Open · SAL Open Call, Oct 18</p>
<h3>Media Director</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> Vice President</p>
<p><strong>Backup</strong> Social Media Lead</p>
<p><strong>Time</strong> 5–6 h/week</p>
<p><strong>Term</strong> One year</p>
<p>Owns how SAL looks and sounds everywhere: Instagram, Telegram, video, design and photography.</p>
<h4>Responsibilities</h4>
<ul><li>Runs @auibsal and The Common Room with the Social Media Lead; keeps a two-week content calendar</li><li>Guards the brand: the design system, templates and sub-brands</li><li>Leads photo and video at every event, with consent and the camera-shy rules</li><li>Serves as Creative Director of Side Quest in the founding term</li><li>Approves routine posts; escalates sensitive content to the President</li><li>Keeps the media archive backed up in two places</li></ul>
<h4>Decides</h4>
<ul><li>Routine posts and the content calendar</li><li>Design of Society materials within the brand guide</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Posting at least three times a week in term</li><li>Every event photographed and archived within a week</li><li>Follower growth and saves tracked monthly</li></ul>
<h4>Hands on</h4>
<ul><li>Account admin rights (two admins minimum)</li><li>Brand files and templates</li><li>Media archive locations</li></ul>
<p><strong>Founding term:</strong> Ali Hayder</p>
<h3>Director of Partnerships &amp; Outreach</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> President</p>
<p><strong>Backup</strong> Club Relations Lead</p>
<p><strong>Time</strong> 3–5 h/week</p>
<p><strong>Term</strong> One year</p>
<p>Connects SAL to other clubs, departments, charities and cultural institutions, and makes sure every partnership is written down and kept.</p>
<h4>Responsibilities</h4>
<ul><li>Keeps the partners register and renewal dates</li><li>Drafts memoranda of understanding (Form F-26) for the President to sign</li><li>Leads charity programmes with partners such as Natrok Athar</li><li>Invites faculty, staff and guest writers with the Director of Letters</li><li>From Year 2: sponsorship under the Partnerships Policy</li><li>From Year 3: links with literary societies at other Baghdad universities</li></ul>
<h4>Decides</h4>
<ul><li>Which partners to approach (within the Partnerships Policy)</li><li>Co-branding on joint events, with the Media Director</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Five active club partners by the end of Year 1</li><li>Every partnership has a signed MoU and a thank-you</li><li>Charity money handed over in full, on time</li></ul>
<h4>Hands on</h4>
<ul><li>Partner register and MoUs</li><li>Contact list with permissions</li></ul>
<p><strong>Founding term:</strong> Covered by the Vice President in the founding term</p>
<h3>Director of Membership &amp; Community</h3>
<p>Appointed</p>
<p><strong>Reports to</strong> Vice President</p>
<p><strong>Backup</strong> Onboarding Lead</p>
<p><strong>Time</strong> 3–5 h/week</p>
<p><strong>Term</strong> One year</p>
<p>Makes SAL easy to join and hard to leave: the register, the welcome, the recognition and the traditions.</p>
<h4>Responsibilities</h4>
<ul><li>Keeps the register and the attendance record from which voting rights are calculated</li><li>Runs the Welcome: new-member evenings, the six words on the typewriter, the first-month buddy</li><li>Runs the Apprenticeship for team roles with each director</li><li>Tracks volunteer hours; prepares Fellow nominations and certificates of service</li><li>Surveys members each semester and reports what they say</li><li>Builds the Alumni Circle from Year 2</li></ul>
<h4>Decides</h4>
<ul><li>Welcome programme and member communications (with Media)</li><li>Who is in good standing, from the record</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Registered members and share who are active</li><li>Two-semester retention</li><li>Member satisfaction survey score</li></ul>
<h4>Hands on</h4>
<ul><li>Register and attendance data (restricted)</li><li>Hours log and recognition records</li></ul>
<p><strong>Founding term:</strong> Open · SAL Open Call, Oct 18</p>
<h2>Advisors</h2>
<p>Two roles that sit beside the Council without a vote.</p>
<h3>Faculty Advisor</h3>
<p>Invited</p>
<p><strong>Reports to</strong> Office of Student Life</p>
<p><strong>Backup</strong> —</p>
<p><strong>Time</strong> About 2 h/month</p>
<p><strong>Term</strong> One year, renewable</p>
<p>A trusted adult in the room: advice, signatures and a steady hand on sensitive matters, without directing the art.</p>
<h4>Responsibilities</h4>
<ul><li>Joins one Council meeting a month and the General Assemblies</li><li>Signs the approvals the University requires</li><li>Reviews the accounts each semester, or names the Audit</li><li>First contact for sensitive issues; hears appeals under B10.6 and B6.10</li><li>Signs certificates of service</li></ul>
<h4>Decides</h4>
<ul><li>Appeals on conduct and elections (final)</li></ul>
<h4>Doing well looks like</h4>
<ul><li>Approvals signed on time</li><li>Audit complete each semester</li></ul>
<h4>Hands on</h4>
<ul><li>Briefing for the next Advisor</li></ul>
<p><strong>Founding term:</strong> To be confirmed by Oct 8</p>
<h3>Founder</h3>
<p>Honorary, permanent</p>
<p><strong>Reports to</strong> —</p>
<p><strong>Backup</strong> —</p>
<p><strong>Time</strong> As agreed</p>
<p><strong>Term</strong> For life</p>
<p>The person who started the Society. Serves as President through the founding term, then as Founding Advisor for one year, then as a friend of the Society.</p>
<h4>Responsibilities</h4>
<ul><li>Founding term: President, with all the duties above</li><li>Appoints the founding officers and directors for confirmation</li><li>After office: Founding Advisor to the Council for one year, without a vote</li><li>Opens Charter Night each year if able</li></ul>
<h4>Decides</h4>
<ul><li>Nothing beyond any office held</li></ul>
<h4>Doing well looks like</h4>
<ul><li>A Society that runs well without its Founder</li></ul>
<h4>Hands on</h4>
<ul><li>The founding story, written down for the archive</li></ul>
<p><strong>Founding term:</strong> Shaheen Farjo</p>
<h2>Programme Chairs</h2>
<p>Standing Programmes are led by a chair who reports to a department, keeps their programme’s handbook, and attends the Council when their programme is discussed.</p>
<table><thead><tr><th>ROLE</th><th>PROGRAMME</th><th>REPORTS TO</th><th>WHAT THEY OWN</th><th>FOUNDING TERM</th></tr></thead><tbody><tr><td><strong>Waraq Editor-in-Chief</strong></td><td>Waraq (journal, working title)</td><td>President as Publisher</td><td>Editorial vision and final contents; chairs the masthead. Full role in the Masthead Handbook.</td><td>Founding: appointed by the Publisher for Issue 1</td></tr><tr><td><strong>Side Quest Creative Director</strong></td><td>Side Quest (series, working title)</td><td>Media Director</td><td>Overall project director of the series; format, crew and releases. Full role in the Production Bible.</td><td>Ali Hayder</td></tr><tr><td><strong>Second Chapter Lead</strong></td><td>Second Chapter (charity drive)</td><td>Director of Partnerships</td><td>Runs each edition with the partner charity; money under the charity rules.</td><td>Edition 1: Shaheen Farjo; hand to a new lead for Edition 2</td></tr><tr><td><strong>Typewriter Tour Lead</strong></td><td>Typewriter Tour (signature pop-up)</td><td>Director of Letters</td><td>Runs the spring tour of the Society Typewriter; six-word pages to the archive and Waraq.</td><td>Open · Spring 2027</td></tr></tbody></table>
<h4>What every chair does</h4>
<ul><li>Keeps a one-page Programme Charter (Form F-29) current</li><li>Recruits their team through the Open Call</li><li>Submits the programme budget to the Treasurer by week 2</li><li>Reports within three weeks of each edition (Form F-25 B)</li><li>Keeps a handover dossier and trains a successor</li></ul>
<h4>What the Council promises chairs</h4>
<ul><li>Editorial and creative independence within the charter (Constitution 10.3)</li><li>Room bookings and approvals through the General Secretary</li><li>A budget decided before the work starts</li><li>Media and volunteer support on request</li><li>Written reasons for any decision that overrules them</li></ul>
<p><strong>Full programme teams</strong> are defined in each programme’s own package: the Waraq Masthead Handbook (about 25 roles), the Side Quest Production Bible (crew of 7–12) and the Second Chapter Operations Kit (core team plus volunteers). This handbook does not repeat them.</p>
<h2>Coordinators and Teams</h2>
<p>Team roles below director level. Each begins with the three-week Apprenticeship. Crimson pills are the roles to fill first, in the founding term.</p>
<table><thead><tr><th>DEPARTMENT</th><th>ROLE</th><th>WHAT THEY DO</th><th>WEEK</th><th>FROM</th></tr></thead><tbody><tr><td>Letters</td><td>Majlis Host</td><td>Hosts the monthly salon: guest, readings, tea, and the conversation.</td><td>2</td><td>Stage 1</td></tr><tr><td>Letters</td><td>Open Pages Lead</td><td>Runs writing workshops with editors and guest writers.</td><td>2</td><td>Stage 1</td></tr><tr><td>Letters</td><td>Book Circle Host</td><td>Chooses and hosts the monthly book, alternating Arabic and English.</td><td>2</td><td>Stage 1</td></tr><tr><td>Letters</td><td>Prizes Coordinator</td><td>Runs the SAL Prizes: call, judges, ceremony.</td><td>2</td><td>Stage 2</td></tr><tr><td>Stage &amp; Arts</td><td>Stage Manager</td><td>Rehearsal schedule, props, cues and safety for every performance.</td><td>3</td><td>Stage 2</td></tr><tr><td>Stage &amp; Arts</td><td>Scratch Night Producer</td><td>Line-up and running order for the informal showcase.</td><td>2</td><td>Stage 1</td></tr><tr><td>Stage &amp; Arts</td><td>Gallery Curator</td><td>Calls for work, hangs and labels the Gallery Wall.</td><td>2</td><td>Stage 2</td></tr><tr><td>Programmes</td><td>Event Coordinator (×2)</td><td>Owns individual events end to end under the Director.</td><td>3</td><td>Stage 1</td></tr><tr><td>Programmes</td><td>Venues &amp; Logistics Lead</td><td>Rooms, furniture, sound, kit list and set-up crews.</td><td>2</td><td>Stage 2</td></tr><tr><td>Programmes</td><td>Volunteer Coordinator</td><td>Rota, briefings and thank-yous for event volunteers.</td><td>2</td><td>Stage 2</td></tr><tr><td>Media</td><td>Social Media Lead</td><td>Daily posting, stories, community replies; deputy to the Media Director.</td><td>3</td><td>Stage 1</td></tr><tr><td>Media</td><td>Design Lead</td><td>Posters, posts and print from the SAL templates.</td><td>3</td><td>Stage 1</td></tr><tr><td>Media</td><td>Photo &amp; Video Lead</td><td>Covers events; keeps the media archive and consent log.</td><td>3</td><td>Stage 2</td></tr><tr><td>Media</td><td>Subtitles &amp; Translation Lead</td><td>Arabic and English versions of posts, videos and notices.</td><td>2</td><td>Stage 2</td></tr><tr><td>Partnerships</td><td>Club Relations Lead</td><td>Keeps contact with partner clubs; joint events.</td><td>2</td><td>Stage 2</td></tr><tr><td>Partnerships</td><td>Charity &amp; Community Lead</td><td>Works with charity partners between editions.</td><td>2</td><td>Stage 2</td></tr><tr><td>Partnerships</td><td>Sponsorship Lead</td><td>Approaches sponsors under the Partnerships Policy.</td><td>2</td><td>Stage 3</td></tr><tr><td>Membership</td><td>Onboarding Lead</td><td>New-member evenings, buddies and the Apprenticeship paperwork.</td><td>2</td><td>Stage 1</td></tr><tr><td>Membership</td><td>Records &amp; Recognition Lead</td><td>Attendance, hours, certificates and Fellow nominations.</td><td>2</td><td>Stage 2</td></tr><tr><td>Membership</td><td>Alumni Lead</td><td>Keeps graduates close: newsletter, reunion, mentoring.</td><td>1</td><td>Stage 3</td></tr><tr><td>Secretariat</td><td>Archivist (Keeper of the Archive)</td><td>Programmes, photos, typed pages, the Book of Members.</td><td>2</td><td>Stage 1</td></tr><tr><td>Treasury</td><td>Deputy Treasurer</td><td>Ledger support; second signature on counts; successor.</td><td>2</td><td>Stage 3</td></tr><tr><td>Treasury</td><td>Cashier (event days)</td><td>Trained to run a till and count with a second person.</td><td>event days</td><td>Stage 1</td></tr></tbody></table>
<h2>Committees</h2>
<p>Three standing committees keep the Society fair. They are small on purpose.</p>
<h4>Elections Committee</h4>
<p><strong>Who:</strong> three Voting Members who will not stand, appointed by mid-March. <strong>Does:</strong> gives notice, checks nominations, runs the Candidates’ Reading, counts, hears complaints, declares results. <strong>Time:</strong> about 10 hours over five weeks.</p>
<h4>Conduct Panel</h4>
<p><strong>Who:</strong> the Vice President (chair), one Council member and one Voting Member drawn by lot. <strong>Does:</strong> hears formal concerns fairly and confidentially; decides outcomes under B10. <strong>Time:</strong> only when needed.</p>
<h4>The Audit</h4>
<p><strong>Who:</strong> the Faculty Advisor, or a Voting Member off the Council whom the Advisor chooses. <strong>Does:</strong> checks the ledger against receipts each semester; reports to the Council and members. <strong>Time:</strong> 2–3 hours a semester.</p>
<h3>What every role holder signs up to</h3>
<ul><li>The Member Pledge and the Code of Conduct</li><li>The Conflict of Interest Declaration (Form F-18), each semester</li><li>Attend your meetings, or send apologies and an update</li><li>Answer Society messages within two working days in term</li></ul>
<ul><li>Keep Society files in the Society Drive, not on personal devices</li><li>Never share member data or unpublished work outside the team</li><li>Keep a handover dossier from week one</li><li>Tell your director early if you need to step back. That is always allowed.</li></ul>
<h2>Who Decides What</h2>
<h4>A Approves (one per row)   R Does the work   C Consulted first</h4>
<h4>I Informed after</h4>
<table><thead><tr><th>DECISION</th><th>GA</th><th>COUNCIL</th><th>PRES</th><th>VP</th><th>GS</th><th>TREAS</th><th>DIRECTOR</th></tr></thead><tbody><tr><td><strong>Amend the Constitution</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td><strong>C</strong></td><td><strong>C</strong></td><td><strong>C</strong></td><td><strong>CHAIR ADVISOR I C C</strong></td></tr><tr><td><strong>Change Bylaws or Policies</strong></td><td><strong>C</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td><strong>I C C</strong></td></tr><tr><td><strong>Adopt the budget</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>C</strong></td><td><strong>C</strong></td><td><strong>I</strong></td><td><strong>R</strong></td><td><strong>I C C</strong></td></tr><tr><td><strong>Spend up to 50,000 IQD</strong></td><td></td><td><strong>I</strong></td><td><strong>I</strong></td><td></td><td></td><td><strong>A</strong></td><td><strong>R R</strong></td></tr><tr><td><strong>Spend up to 250,000 IQD</strong></td><td></td><td><strong>I</strong></td><td><strong>A</strong></td><td></td><td></td><td><strong>R</strong></td><td><strong>R C</strong></td></tr><tr><td><strong>Spend above 250,000 IQD</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td></td><td></td><td><strong>R</strong></td><td><strong>C C C</strong></td></tr><tr><td><strong>Greenlight a new programme</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>C</strong></td><td><strong>R</strong></td><td><strong>I</strong></td><td><strong>C</strong></td><td><strong>R I C</strong></td></tr><tr><td><strong>Select work for Waraq</strong></td><td></td><td><strong>I</strong></td><td><strong>I</strong></td><td></td><td></td><td></td><td><strong>A</strong></td></tr><tr><td><strong>Overrule an editorial decision</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td><strong>I</strong></td><td></td><td><strong>C C</strong></td></tr><tr><td><strong>Appoint directors</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td></td><td><strong>I</strong></td></tr><tr><td><strong>Appoint programme chairs</strong></td><td></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td></td><td></td><td><strong>R I</strong></td></tr><tr><td><strong>Sign a partnership MoU</strong></td><td></td><td><strong>C</strong></td><td><strong>A</strong></td><td></td><td><strong>C</strong></td><td><strong>C</strong></td><td><strong>R I C</strong></td></tr><tr><td><strong>Public statement</strong></td><td></td><td><strong>C</strong></td><td><strong>A</strong></td><td><strong>C</strong></td><td><strong>I</strong></td><td></td><td><strong>I C</strong></td></tr><tr><td><strong>Routine social post</strong></td><td></td><td></td><td><strong>I</strong></td><td></td><td></td><td></td><td><strong>A</strong></td></tr><tr><td><strong>Conduct case outcome</strong></td><td></td><td><strong>I</strong></td><td><strong>C</strong></td><td><strong>A</strong></td><td><strong>I</strong></td><td></td><td><strong>C</strong></td></tr><tr><td><strong>Remove a member</strong></td><td></td><td><strong>A</strong></td><td><strong>C</strong></td><td><strong>R</strong></td><td><strong>I</strong></td><td></td><td><strong>C</strong></td></tr><tr><td><strong>Run the election</strong></td><td><strong>I</strong></td><td><strong>I</strong></td><td><strong>I</strong></td><td></td><td><strong>R</strong></td><td></td><td><strong>C</strong></td></tr><tr><td><strong>Name Fellows / Honorary</strong></td><td><strong>I</strong></td><td><strong>A</strong></td><td><strong>R</strong></td><td><strong>C</strong></td><td><strong>C</strong></td><td></td><td><strong>R R I</strong></td></tr><tr><td><strong>Book rooms, Student Life requests</strong></td><td></td><td></td><td><strong>I</strong></td><td></td><td><strong>A</strong></td><td></td><td><strong>R R</strong></td></tr><tr><td>Director = the director whose department the decision belongs to. Chair = the relevant Programme Chair. Where this table and the Constitution differ, the Constitution prevails.</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>Succession and Backup</h2>
<p>Student societies usually die in the year after their founders graduate. Ours is designed to survive that year.</p>
<table><thead><tr><th>IF THIS PERSON IS AWAY…</th><th>…THIS PERSON STEPS IN</th><th>…AND IS BEING PREPARED TO SUCCEED</th></tr></thead><tbody><tr><td><strong>President</strong></td><td>Vice President</td><td>Vice President or a director with a full year</td></tr><tr><td><strong>Vice President</strong></td><td>General Secretary</td><td>Any director</td></tr><tr><td><strong>General Secretary</strong></td><td>Vice President</td><td>Archivist</td></tr><tr><td><strong>Treasurer</strong></td><td>President (second signature: VP)</td><td>Deputy Treasurer or a trained cashier</td></tr><tr><td><strong>Any director</strong></td><td>Their named coordinator</td><td>That coordinator</td></tr><tr><td><strong>Programme chair</strong></td><td>Their deputy in the programme</td><td>Deputy or section lead</td></tr></tbody></table>
<h4>The founder’s year</h4>
<p>The first election is in April 2027. From then, the Founder holds office only if elected, and may sit with the Council for one year as Founding Advisor, without a vote. By Charter Night 2027, the Society should be run entirely by people who joined after it was founded.</p>
<h4>Shadow, then hand over</h4>
<p>Newly elected officers shadow their predecessors from the AGM (April 20) to handover (May 13). Every role keeps a handover dossier (F-24), and access to every account moves within seven days.</p>
<h2>Pathways</h2>
<p>Nobody needs permission to get more involved. This is the usual path, but any member may apply for any role.</p>
<h4>01 · Friend</h4>
<p>Follows @auibsal, comes to a Majlis</p>
<h4>02 · Member</h4>
<p>Registers, signs the Pledge, types six words</p>
<h4>03 · Voting Member</h4>
<p>Two recorded activities in a semester</p>
<h4>04 · Apprentice</h4>
<p>Three weeks, one real task, a mentor</p>
<h4>05 · Coordinator</h4>
<p>Owns a piece of a department</p>
<h4>06 · Director or Chair</h4>
<p>Leads a department or a programme</p>
<h4>07 · Officer</h4>
<p>Elected by the members</p>
<h4>08 · Fellow</h4>
<p>Honoured for service; for life</p>
<h2>What members take away</h2>
<p>A named role on a real publication, production or event; a certificate of service signed by the Faculty Advisor; a reference from the President on request; and, for those who give the most, a Fellowship for life.</p>
<h2>The First Open Call</h2>
<p>One call, opening Sunday, October 18, for every open role in the Society and its programmes. Director applications close Monday, October 26; interviews October 27–29; the Council is announced Saturday, October 31.</p>
<table><thead><tr><th>ROLE</th><th>PLACES</th><th>NOTE</th><th>PRIORITY</th></tr></thead><tbody><tr><td><strong>Director of Letters</strong></td><td>1</td><td>Also covers Stage &amp; Arts this year</td><td>High</td></tr><tr><td><strong>Director of Programmes &amp; Events</strong></td><td>1</td><td></td><td>High</td></tr><tr><td><strong>Director of Membership &amp; Community</strong></td><td>1</td><td></td><td>High</td></tr><tr><td><strong>Social Media Lead</strong></td><td>1</td><td>Deputy to the Media Director</td><td>High</td></tr><tr><td><strong>Design Lead</strong></td><td>1</td><td></td><td>High</td></tr><tr><td><strong>Event Coordinator</strong></td><td>2</td><td>First event: Second Chapter</td><td>High</td></tr><tr><td><strong>Onboarding Lead</strong></td><td>1</td><td></td><td>Medium</td></tr><tr><td><strong>Archivist</strong></td><td>1</td><td>Reports to the General Secretary</td><td>Medium</td></tr><tr><td><strong>Majlis Host</strong></td><td>1</td><td>First Majlis in December or January</td><td>Medium</td></tr><tr><td><strong>Second Chapter deputy</strong></td><td>1</td><td>Leads Edition 2</td><td>High</td></tr><tr><td><strong>Cashiers (event days)</strong></td><td>4</td><td>Trained for Second Chapter, Nov 8–11</td><td>High</td></tr><tr><td><strong>Waraq masthead</strong></td><td>~20</td><td>Per the Masthead Handbook; closes Oct 29</td><td>High</td></tr><tr><td><strong>Side Quest crew</strong></td><td>5–8</td><td>Per the Production Bible</td><td>High</td></tr><tr><td>The all-student email and posts are in the Templates &amp; Forms Pack (L-04) and the printables. The application form is F-03; the interview score sheet is F-04.</td><td></td><td></td><td></td></tr></tbody></table>
$doc$),
  ('policy-manual', 'SAL-POL-01', 'Policy Manual', 'دليل السياسات', 'How we treat people, money, words, images and data, in eighteen short policies.', 'public', 'draft', 'Draft 1', '2026-09-28', null, null, 40,
   $doc$<h2>How Policies Work</h2>
<p>Each policy is short, has an owner, and is reviewed every year. Where a policy is silent, members use judgement and ask the owner.</p>
<h4>Who they bind</h4>
<p>Every member at every Society activity, online and offline, and every role holder at all times while acting for the Society.</p>
<h4>Where they sit</h4>
<p>Below University policy, the Constitution and the Bylaws. If they conflict, the higher document wins.</p>
<h4>How they change</h4>
<p>By two-thirds of the Council, reported to members within seven days; members can overturn a change at the next General Assembly.</p>
<h4>Owners and review</h4>
<table><thead><tr><th>NO.</th><th>POLICY</th><th>OWNER</th><th>REVIEW</th></tr></thead><tbody><tr><td>P1</td><td>Code of Conduct Respect and Anti-Harassment</td><td>Vice President Vice President</td><td>September September</td></tr><tr><td>P2</td><td>Safeguarding</td><td>President</td><td>September</td></tr><tr><td>P3</td><td>Expression and Content</td><td>President</td><td>September</td></tr><tr><td>P4</td><td>Consent, Photography and Media</td><td>Media Director</td><td>September</td></tr><tr><td>P5</td><td>Privacy and Member Data</td><td>General Secretary</td><td>September</td></tr><tr><td>P6</td><td>Money and Cash</td><td>Treasurer</td><td>September</td></tr><tr><td>P7</td><td>Conflicts of Interest and Gifts</td><td>General Secretary</td><td>September</td></tr><tr><td>P8</td><td>Credit and Creative Work</td><td>Director of Letters</td><td>September</td></tr><tr><td>P9</td><td>Generative AI</td><td>Director of Letters</td><td>September</td></tr><tr><td>P10</td><td>Partnerships and Sponsorship</td><td>Director of Partnerships</td><td>September</td></tr><tr><td>P11</td><td>Communications and Brand</td><td>Media Director</td><td>September</td></tr><tr><td>P12</td><td>Events and Safety</td><td>Director of Programmes</td><td>September</td></tr><tr><td>P13</td><td>Inclusion and Accessibility</td><td>Director of Membership</td><td>September</td></tr><tr><td>P14</td><td>Accounts and Access</td><td>General Secretary</td><td>September</td></tr><tr><td>P15</td><td>Records and the Archive</td><td>General Secretary</td><td>September</td></tr><tr><td>P16</td><td>Complaints</td><td>Vice President</td><td>September</td></tr><tr><td>P17</td><td>Speaking Up About Money</td><td>Faculty Advisor</td><td>September</td></tr><tr><td>P18</td><td></td><td></td><td></td></tr><tr><td><strong>DOCUMENT</strong> SAL-POL-01</td><td><strong>VERSION</strong> 1.0 (draft)</td><td><strong>OWNER APPROVED BY</strong> General Secretary Council (two-thirds)</td><td></td></tr><tr><td>Next review: each September. The current version always lives in <em>SAL Drive › 01 Governance</em>; printed copies may be out of date.</td><td></td><td></td><td></td></tr></tbody></table>
<h3>P1 · Code of Conduct</h3>
<p><strong>1.1</strong> Treat everyone at a Society activity with courtesy, whatever their views, language, college or background.</p>
<p><strong>1.2</strong> Critique the work, never the person. Feedback in workshops and editorial meetings is specific, kind and useful.</p>
<p><strong>1.3</strong> Keep your commitments, or say early that you cannot. Stepping back is always allowed; disappearing is not.</p>
<p><strong>1.4</strong> Respect the University’s rules, its property, and the rooms and people who host us. Leave every room as you found it.</p>
<p><strong>1.5</strong> Keep confidential what is confidential: unpublished submissions, votes, personal data and conduct cases.</p>
<p><strong>1.6</strong> No alcohol, drugs or weapons at any Society activity. No one attends a Society activity intoxicated.</p>
<p><strong>1.7</strong> Online, the same rules apply in Society groups and when speaking as a member of the Society.</p>
<h3>P2 · Respect and Anti-Harassment</h3>
<p><strong>2.1</strong> Harassment, bullying, intimidation, discrimination and unwanted physical contact or attention are not tolerated, in person or online.</p>
<p><strong>2.2</strong> Jokes, comments or content that demean anyone for their gender, ethnicity, religion, sect, language, nationality, disability or appearance are harassment, whatever the intent.</p>
<p><strong>2.3</strong> Anyone who experiences or sees harassment may tell any officer, the Faculty Advisor or the Office of Student Life. They will be believed, listened to and protected from retaliation.</p>
<p><strong>2.4</strong> Serious cases are referred to Student Life under University policy (B10.7). The Society may suspend a member from activities while a case is open.</p>
<h3>P3 · Safeguarding</h3>
<p><strong>3.1</strong> Some programmes reach children or vulnerable people, for example through charity partners or school visits. Their safety comes before any event or photograph.</p>
<p><strong>3.2</strong> No member is alone with a child. Activities with children always have at least two members present and a partner organisation responsible for the children.</p>
<p><strong>3.3</strong> No identifiable photographs of children are taken or published by the Society, even with permission.</p>
<p><strong>3.4</strong> Anyone worried about a child’s safety tells the President or the Faculty Advisor the same day. The Society does not investigate; it refers to Student Life and the responsible partner.</p>
<h3>P4 · Expression and Content</h3>
<p><strong>4.1</strong> Literature and art deal with the whole of human life, including grief, love, faith, violence, war and doubt. The Society defends its members’ right to write, perform and publish serious work.</p>
<p><strong>4.2</strong> The Society is non-partisan and non-sectarian. It does not campaign for parties, candidates or sects, and its channels are not used to do so.</p>
<p><strong>4.3</strong> Society content does not incite hatred or violence, defame real people, reveal private information, or break the law or University policy.</p>
<p><strong>4.4</strong> Work that deals with sensitive subjects carries a short content note where readers or audiences would want one.</p>
<p><strong>4.5</strong> If an editor or director is unsure, they ask the Programme Chair, then the President, then the Faculty Advisor, in that order. Waraq also has its Advisory Board for flagged pieces.</p>
<p><strong>4.6</strong> Editorial decisions belong to the editors (Constitution 10.3). Overruling one requires grounds of law, safety or University policy, and written reasons.</p>
<p><strong>4.7</strong> Light formats such as Side Quest and Bad Poetry Night keep to their own rulebooks: no takes on politics, religion, sect or ethnicity.</p>
<h3>P5 · Consent, Photography and Media</h3>
<p><strong>5.1</strong> Anyone clearly featured in Society video or photography, or in an interview, signs a release (Form F-17) before publication. Guests see their episode or feature before it is released.</p>
<p><strong>5.2</strong> At every event, a notice says that photography is taking place. Anyone may wear a camera-shy sticker or ask not to be photographed; photographers respect this without question.</p>
<p><strong>5.3</strong> Anyone may ask for a photo or video of themselves to be removed. The Society takes it down within 24 hours, no reasons needed.</p>
<p><strong>5.4</strong> Crowd photographs are fine; close-ups of individuals who have not agreed are not published.</p>
<p><strong>5.5</strong> Photographs of people praying, in distress or in private moments are not taken.</p>
<h3>P6 · Privacy and Member Data</h3>
<p><strong>6.1</strong> The Society collects only what it needs: name, AUIB email, college, year, phone (optional), and attendance. It never collects ID numbers or bank details.</p>
<p><strong>6.2</strong> Member data lives in the restricted Members folder, seen only by the officers, the Director of Membership and the Records Lead.</p>
<p><strong>6.3</strong> Member data is never shared outside the Society or used for anything other than Society business, including campaigning in Society elections.</p>
<p><strong>6.4</strong> Members may ask to see or delete their data at any time. Data of members who leave is deleted one year after they leave, except their name and roles in the archive.</p>
<p><strong>6.5</strong> Submissions, ballots and conduct records follow their own retention rules: Waraq’s guidelines, B6.11 and B10.8.</p>
<h3>P7 · Money and Cash</h3>
<p><strong>7.1</strong> Spend only within an approved budget and within the limits in Constitution 13.2: up to 50,000 IQD by a Director with the Treasurer, up to 250,000 IQD by the President and the Treasurer, above that by Council vote.</p>
<p><strong>7.2</strong> Get a receipt for every purchase and upload a photo within 48 hours. No receipt, no reimbursement, except where the Treasurer accepts a signed note for a small purchase where receipts are not given.</p>
<p><strong>7.3</strong> Cash is counted by two people, recorded and signed on Form F-14, and never kept overnight by one student.</p>
<p><strong>7.4</strong> No personal loans from Society money, no mixing of Society money with personal money, and no payments to yourself approved by yourself.</p>
<p><strong>7.5</strong> Charity money is held separately, never used for costs, and handed over in full at a witnessed handover with a receipt.</p>
<p><strong>7.6</strong> Prices charged to members and the public are set by the Council and displayed.</p>
<h3>P8 · Conflicts of Interest and Gifts</h3>
<p><strong>8.1</strong> A conflict of interest is any situation where a personal interest, relationship or loyalty could affect, or seem to affect, a Society decision.</p>
<p><strong>8.2</strong> Role holders complete Form F-18 each semester and declare new conflicts as they arise, at the start of the meeting concerned.</p>
<p><strong>8.3</strong> A person with a conflict does not vote on, score or approve the matter. Examples: interviewing a close friend; reading a partner’s submission; choosing a supplier owned by family.</p>
<p><strong>8.4</strong> Gifts to the Society are recorded by the Treasurer. Personal gifts to role holders because of their role are declined, except small tokens of thanks under 10,000 IQD.</p>
<h3>P9 · Credit and Creative Work</h3>
<p><strong>9.1</strong> Creators own their work. By presenting or submitting it, they give the Society permission to show, perform, publish and archive it for the purpose agreed, and nothing more.</p>
<p><strong>9.2</strong> Everyone who works on a Society project is credited by name in its programme, masthead or end credits, unless they ask not to be.</p>
<p><strong>9.3</strong> Published plays, music and images used by the Society have the rights holder’s permission, or are in the public domain. The Director of Stage &amp; Arts keeps the rights file.</p>
<p><strong>9.4</strong> The Society’s name, the Key monogram, its templates and its programme names belong to the Society. Members may use them only for Society business.</p>
<p><strong>9.5</strong> Plagiarism in any Society programme leads to withdrawal of the work and may lead to action under P1.</p>
<h3>P10 · Generative AI</h3>
<p><strong>10.1</strong> Creative work submitted to Society programmes (Waraq, the Prizes, Scratch Night, the Typewriter Tour) must be the member’s own. Work drafted, written, translated or generated by AI is not eligible. Spellcheck and basic grammar tools are fine.</p>
<p><strong>10.2</strong> AI detectors are unreliable and are never used as evidence on their own. Where there is a real concern, editors talk to the author and may ask for drafts, following Waraq’s procedure.</p>
<p><strong>10.3</strong> Role holders may use AI tools for administrative drafting, provided a person checks every word and fact, and no member data or unpublished submissions are put into them.</p>
<p><strong>10.4</strong> AI-generated images are not used in Society promotion without being labelled, and never to depict real people.</p>
<h3>P11 · Partnerships and Sponsorship</h3>
<p><strong>11.1</strong> The Society partners with clubs, departments, charities and cultural organisations whose aims fit its mission and who treat people fairly.</p>
<p><strong>11.2</strong> Every partnership that involves money, shared branding or shared responsibility has a written memorandum (Form F-26), signed by the President.</p>
<p><strong>11.3</strong> The Society does not accept sponsorship from political parties, religious or sectarian bodies, tobacco, alcohol or gambling businesses, or any sponsor that would compromise its independence.</p>
<p><strong>11.4</strong> Sponsors get acknowledgement, never editorial influence. Sponsorship above 250,000 IQD needs a Council vote and, where required, Student Life approval.</p>
<p><strong>11.5</strong> Charity partners are checked before each edition: who they are, who they help, how they account for money, and whether they will provide receipts.</p>
<h3>P12 · Communications and Brand</h3>
<p><strong>12.1</strong> The official channels are @auibsal, The Common Room on Telegram, the Society’s AUIB email and the all-student email through Student Life.</p>
<p><strong>12.2</strong> Routine posts are approved by the Media Director or the Social Media Lead. Posts about sensitive subjects, partners’ money or University matters are approved by the President.</p>
<p><strong>12.3</strong> Only the President, or someone the President names, speaks for the Society to the press, to other institutions or in public statements.</p>
<p><strong>12.4</strong> All Society materials follow the Brand &amp; Identity Guide. Programme sub-brands carry “a Society of Arts and Letters programme”.</p>
<p><strong>12.5</strong> If a post causes harm or a serious error, it is taken down first and discussed after. The Media Director tells the President within the hour.</p>
<p><strong>12.6</strong> Arabic and English appear together on calls, notices and major announcements.</p>
<h3>P13 · Events and Safety</h3>
<p><strong>13.1</strong> Every event follows the event process in the Operations Playbook, including the lead times for Student Life approvals.</p>
<p><strong>13.2</strong> Events over 30 people, events with equipment or cash, and any off-campus activity complete a risk check (Form F-11) approved by the Director of Programmes.</p>
<p><strong>13.3</strong> Off-campus activities, including the Mutanabbi Walk, go ahead only with written Student Life approval, a named lead, a register of who is attending, and a plan for transport and emergencies.</p>
<p><strong>13.4</strong> Every event has a named lead on the day who knows the exits, the first-aid point and the Student Life and security contacts.</p>
<p><strong>13.5</strong> Incidents, however small, are recorded on Form F-19 within 24 hours.</p>
<h3>P14 · Inclusion and Accessibility</h3>
<p><strong>14.1</strong> Everything the Society runs is free to members, or has a free way to take part.</p>
<p><strong>14.2</strong> The Society chooses venues that everyone attending can reach, and asks on sign-up forms whether anyone needs adjustments.</p>
<p><strong>14.3</strong> Arabic and English are both welcome at every activity. Readings in one language are introduced in the other where possible.</p>
<p><strong>14.4</strong> Events are timed to allow members who commute or have family duties to attend, and major events are not held in exam weeks.</p>
<p><strong>14.5</strong> The Director of Membership reviews each semester who is joining and who is not, and proposes outreach to under-represented colleges and groups.</p>
<h3>P15 · Accounts and Access</h3>
<p><strong>15.1</strong> Every Society account (Instagram, Telegram, email, Drive, forms) has at least two administrators on the Council, and two-step verification switched on.</p>
<p><strong>15.2</strong> Passwords are kept in a shared password manager held by the General Secretary and the Media Director, never in chats or documents.</p>
<p><strong>15.3</strong> Access is given for the role, not the person, and removed within seven days of someone leaving a role.</p>
<p><strong>15.4</strong> Society files are kept in the Society Drive, not on personal devices or personal accounts.</p>
<h3>P16 · Records and the Archive</h3>
<p><strong>16.1</strong> Kept for as long as the Society exists: the Constitution and every version of it, the Founders’ Roll, minutes and decisions logs, annual reports and accounts, programmes and term cards, Waraq issues, the Book of Members and the Book of Fellows, and a selection of photographs.</p>
<p><strong>16.2</strong> Kept for two years: event plans, risk checks, receipts and correspondence. Then reviewed by the Archivist.</p>
<p><strong>16.3</strong> Each semester, the Archivist deposits a copy of printed materials with the University Library if the Library agrees.</p>
<h3>P17 · Complaints</h3>
<p><strong>17.1</strong> Anyone, member or not, may complain about the Society or any member acting for it, by speaking to any officer or on Form F-20.</p>
<p><strong>17.2</strong> Complaints are acknowledged within three days and answered within fourteen, following B10 where conduct is involved.</p>
<p><strong>17.3</strong> A complainant who is not satisfied may take the matter to the Faculty Advisor, and then to the Office of Student Life.</p>
<p><strong>17.4</strong> Nobody is disadvantaged for making a complaint in good faith.</p>
<h3>P18 · Speaking Up About Money</h3>
<p><strong>18.1</strong> Anyone who believes Society money or property is being misused should tell the Treasurer, the President or, if either is involved, the Faculty Advisor directly.</p>
<p><strong>18.2</strong> The concern is treated confidentially. The Faculty Advisor may order an immediate Audit.</p>
<p><strong>18.3</strong> Raising a concern honestly is never a disciplinary matter, even if it turns out to be mistaken.</p>
<h2>The Member Pledge</h2>
<p>The short version, signed by every member when they join (Form F-02) and read aloud by the new Council at the Ribbon.</p>
<p>As a member of the Society of Arts and Letters, I will treat everyone with courtesy and every piece of work with care. I will critique the work and never the person. I will respect consent, before a camera and on the page. I will be honest with the Society’s money and its members’ trust. I will keep what is confidential, keep my word or say early that I cannot, and leave every room better than I found it.</p>
$doc$),
  ('strategic-plan', 'SAL-STR-01', 'Strategic Plan 2026–2029', 'الخطة الاستراتيجية 2026–2029', 'Where the Society of Arts and Letters is going in its first three years, and how we will know.', 'public', 'draft', 'Draft 1', '2026-09-28', null, null, 50,
   $doc$<h2>Where We Are</h2>
<p>SAL began as a handful of students who wanted the campus to read, write and make things together. In one year it has become four programmes, a brand and a following. What it lacks is structure.</p>
<p>[founding date]</p>
<h4>The Society is founded</h4>
<p>Shaheen Farjo starts the Society of Arts and Letters at AUIB.</p>
<p>February 2026</p>
<h4>The journal brief</h4>
<p>A first brief, guidelines and rubric for a campus literary journal.</p>
<p>Spring 2026</p>
<h4>The Typewriter Tour</h4>
<p>A typewriter travels the campus and collects six-word stories, with permission to publish. It proves the campus will write when invited.</p>
<p>September 2026</p>
<h4>Three programmes proposed</h4>
<p><strong>Second Chapter</strong>, a charity book drive for Natrok Athar; <strong>Waraq</strong> (working title), a bilingual journal; <strong>Side Quest</strong> (working title), a campus video series. Each with a full operating package.</p>
<p>October 13, 2026</p>
<h4>Charter Day</h4>
<p>The Constitution is ratified and the Society gets the structure to carry all of this.</p>
<h2>The gap this plan closes</h2>
<p>We have more ideas than people, more programmes than procedures, and a founder who will one day graduate. This plan, and the documents around it, turn a successful group of friends into an institution.</p>
<h2>Who We Are</h2>
<p><strong>MISSION</strong></p>
<p>To cultivate a culture of literature and creative expression across AUIB.</p>
<p><strong>VISION</strong></p>
<p>A campus where every student has a place to read, write, perform and make, and a Society whose work outlasts the people who start it.</p>
<p><strong>MOTTO</strong></p>
<p lang="ar">والقرطاسُ والقلم</p>
<p>The paper and the pen</p>
<p><strong>VALUES</strong></p>
<h4>1 · Open door</h4>
<p>Free, for every student, in every college, in both languages.</p>
<h4>2 · Craft</h4>
<p>We take the work seriously, even when it is fun.</p>
<h4>3 · Two languages, one page</h4>
<p>Arabic and English on equal footing.</p>
<h4>4 · Care</h4>
<p>Consent before cameras, safety before spectacle.</p>
<h4>5 · Every dinar visible</h4>
<p>Money is counted twice and reported.</p>
<h4>6 · Built to last</h4>
<p>Written down, handed on, archived.</p>
<p>Instagram <strong>@auibsal</strong>     Telegram <strong>The Common Room</strong></p>
<h2>Four Pillars</h2>
<p>The pillars come from the Society’s founding overview. Every programme must serve at least one; the Council asks which, every time it greenlights one.</p>
<h4>Connecting students</h4>
<p>Bring people from every college into one room, and one publication. <strong>We measure:</strong> Share of members from outside the humanities; joint events with other clubs</p>
<h4>Fostering creativity</h4>
<p>Turn private drafts into finished work, with deadlines, editors and stages. <strong>We measure:</strong> Submissions to Waraq; pieces performed at Scratch Night; workshop attendance</p>
<h4>Celebrating culture</h4>
<p>Arabic and English side by side; Iraqi writing next to world writing. <strong>We measure:</strong> Share of Arabic content; translations published; Majlis guests</p>
<h4>Building a community</h4>
<p>A society people stay in for four years and come back to after. <strong>We measure:</strong> Two-semester retention; volunteer hours; alumni at Charter Night</p>
<h4>Which programme serves which pillar</h4>
<table><thead><tr><th>PROGRAMME</th><th>CONNECTING</th><th>CREATIVITY</th><th>CULTURE</th><th>COMMUNITY</th></tr></thead><tbody><tr><td><strong>Waraq</strong></td><td></td><td><strong>●</strong></td><td><strong>●</strong></td><td><strong>●</strong></td></tr><tr><td><strong>Side Quest</strong></td><td><strong>●</strong></td><td><strong>●</strong></td><td></td><td><strong>●</strong></td></tr><tr><td><strong>Second Chapter</strong></td><td><strong>●</strong></td><td></td><td><strong>●</strong></td><td><strong>●</strong></td></tr><tr><td><strong>Typewriter Tour</strong></td><td><strong>●</strong></td><td><strong>●</strong></td><td><strong>●</strong></td><td></td></tr><tr><td><strong>The Majlis</strong></td><td><strong>●</strong></td><td></td><td><strong>●</strong></td><td><strong>●</strong></td></tr><tr><td><strong>Open Pages</strong></td><td></td><td><strong>●</strong></td><td><strong>●</strong></td><td></td></tr><tr><td><strong>Scratch Night</strong></td><td><strong>●</strong></td><td><strong>●</strong></td><td></td><td><strong>●</strong></td></tr><tr><td><strong>Book Circle</strong></td><td><strong>●</strong></td><td></td><td><strong>●</strong></td><td><strong>●</strong></td></tr></tbody></table>
<h2>Learning from the Old Societies</h2>
<p>The best campus literary societies have lasted two centuries. We borrowed what made them last, and left behind what made them exclusive.</p>
<table><thead><tr><th>SINCE</th><th>SOCIETY</th><th>WHAT THEY DO</th><th>WHAT SAL TAKES</th></tr></thead><tbody><tr><td>1795</td><td><strong>Dialectic &amp; Philanthropic Societies</strong> UNC, USA <strong>Philolexian Society</strong></td><td>Among the oldest student societies in the US. Its members built a library of over 10,000 volumes that seeded the university library, and chose a motto that still stands. Weekly Thursday meetings of debate and literature,</td><td>A motto; the SAL book-swap shelf; the archive left to the Library on dissolution Motion Night; Bad Poetry</td></tr><tr><td>1802</td><td>Columbia, USA <strong>University Philosophical</strong></td><td>the magazine <em>Surgam</em>, and the famous Joyce Kilmer Memorial Bad Poetry Contest. New members earn their place by taking part. Paper readings and debates every Thursday; an</td><td>Night; voting rights earned by taking part A small elected Council; SAL</td></tr><tr><td>1848</td><td><strong>Society, “the Phil”</strong> Trinity College Dublin <strong>Footlights</strong></td><td>elected council of nine officers; medals for the best paper and speaker, and honorary patronage for distinguished guests. Informal “smokers” where anyone can try new</td><td>Prizes; Honorary Members Scratch Night and the theatre</td></tr><tr><td>1883</td><td>Cambridge, UK <strong>The Elizabethan Club</strong></td><td>sketches before an audience, and a path from there to full productions. Founded for students and faculty to talk about</td><td>ladder The Majlis, with tea, where</td></tr><tr><td>1911</td><td>Yale, USA <strong>Al-Rabita al-Qalamiyya,</strong></td><td>literature over tea, served every afternoon of term, beside a vault of rare books. Gibran, Naimy and their circle met in salons and set</td><td>faculty come as readers Bilingual by design; translation</td></tr><tr><td>1920</td><td><strong>the Pen League</strong> New York <strong>The Harvard Advocate</strong></td><td>out to renew Arabic literature, writing across two languages. Boards by craft (art, fiction, poetry, features, design,</td><td>as a craft; the salon Departments by craft; the</td></tr><tr><td>Today</td><td>Harvard, USA <strong>Al-Mutanabbi Street and</strong></td><td>business, tech) and a “comp” through which newcomers join. A city whose book market and Abbasid-era translators</td><td>three-week Apprenticeship Our motto; the name Waraq;</td></tr><tr><td>Always</td><td><strong>the House of Wisdom</strong> Baghdad</td><td>are the oldest literary society we can claim.</td><td>the Mutanabbi Walk</td></tr></tbody></table>
<p><strong>What we did not borrow:</strong> invitation-only membership, secret initiations, and fees. SAL is open, free and public, and our traditions (six words on the typewriter, the Ribbon) are ones anyone can join.</p>
<h2>The Programme Portfolio</h2>
<p><strong>STANDING PROGRAMMES · EACH WITH A CHAIR AND A HANDBOOK</strong></p>
<p>Waraq</p>
<p>The bilingual journal (working title). Two issues a year, read blind, launched in public. Issue 1: February 24, 2027.</p>
<p>Side Quest</p>
<p>The campus video series (working title). Six episodes a semester; pilot premiere November 19, 2026.</p>
<p>Second Chapter</p>
<p>The charity book drive and fair, every fall. Edition 1: November 1–11, 2026, for Natrok Athar.</p>
<p>Typewriter Tour</p>
<p>The Society Typewriter on tour every spring, collecting six-word stories for the archive and Waraq.</p>
<p><strong>REGULAR PROGRAMMES · RUN BY THE DEPARTMENTS</strong></p>
<p><strong>The Majlis</strong></p>
<p>Monthly salon with tea: a guest, three readings, open conversation. Faculty welcome as readers.</p>
<p><strong>Open Pages</strong></p>
<p>Writing workshops, twice a semester, with editors on hand.</p>
<p><strong>Book Circle</strong></p>
<p>One book a month, alternating Arabic and English.</p>
<p><strong>Scratch Night</strong></p>
<p>Try a scene, poem or sketch in front of friends. The first step on the theatre ladder.</p>
<p><strong>Motion Night</strong></p>
<p>“This house would burn the classics.” A literary debate, once a term.</p>
<p><strong>Bad Poetry Night</strong></p>
<p>The worst poem at AUIB wins. Low stakes, high laughter, many new members.</p>
<p><strong>Gallery Wall</strong></p>
<p>A rotating wall of student art and photography.</p>
<p><strong>The Mutanabbi Walk</strong></p>
<p>A Friday visit to al-Mutanabbi Street, with Student Life approval and a safety plan.</p>
<p><strong>ANNUAL MOMENTS</strong></p>
<p><strong>Charter Night</strong></p>
<p>Every October: the anniversary, the Founders’ Roll, new members type their six words.</p>
<p><strong>SAL Prizes</strong></p>
<p>From Year 2: prizes for writing in Arabic and English, awarded at the AGM.</p>
<p><strong>The AGM and the Ribbon</strong></p>
<p>Every April: reports, results and the handover.</p>
<p><strong>Term Card</strong></p>
<p>Each semester’s programme on one printed card, in the Oxford tradition.</p>
<h2>A Year in the Society</h2>
<p>The 2026–27 academic year. Exam weeks are kept clear once the University calendar is confirmed.</p>
<table><thead><tr><th>STREAM</th><th>SEP</th><th>OCT</th><th>NOV</th><th>DEC</th><th>JAN</th><th>FEB</th><th>MAR</th></tr></thead><tbody><tr><td><strong>Governance</strong></td><td>Opening GA</td><td>Charter Day · Open Call Call opens</td><td>Deadline</td><td>Semester report Selection</td><td>Spring Open Call Editing</td><td>Launch Feb</td><td><strong>APR MAY</strong> Elections Elections · Handover Committee AGM · Ribbon Issue 2 call</td></tr><tr><td><strong>Waraq</strong></td><td></td><td>Oct 18 Pilot shoot</td><td>Nov 26 Premiere</td><td>Reels</td><td>Season 1</td><td>24 Episodes</td><td>Episodes Finale</td></tr><tr><td><strong>Side Quest</strong></td><td></td><td>Drive prep</td><td>Nov 19 Drive · Fair</td><td>Impact</td><td>prep</td><td></td><td></td></tr><tr><td><strong>Second Chapter</strong></td><td></td><td></td><td></td><td>report</td><td></td><td></td><td>Tour Pages to</td></tr><tr><td><strong>Typewriter Tour</strong></td><td></td><td></td><td>Open Pages</td><td>First Majlis</td><td>Majlis · Book</td><td>Majlis</td><td>archive Majlis · Majlis</td></tr><tr><td><strong>Letters</strong></td><td></td><td></td><td></td><td></td><td>Circle</td><td>Scratch</td><td>Motion Night Bad Poetry</td></tr><tr><td><strong>Stage &amp; Arts</strong></td><td>Welcome</td><td>Charter</td><td></td><td></td><td>Spring</td><td>Night</td><td>Night SAL Prizes</td></tr><tr><td><strong>Community</strong></td><td>evening</td><td>Night</td><td></td><td></td><td>Welcome</td><td></td><td>(Yr 2)</td></tr></tbody></table>
<h4>The rhythm</h4>
<p>Council every two weeks. One Majlis a month. One big programme moment a month. Nothing big in exam weeks.</p>
<h4>The Term Card</h4>
<p>Each semester’s dates are fixed by week 3 and printed on one card, so members can plan around us.</p>
<h4>The summer</h4>
<p>A half-day planning retreat for the new Council in the first week of term: budget, calendar, work plans.</p>
<h2>Three Years</h2>
<p>Foundation, growth, institution. Each year’s goals are reviewed at the AGM and rolled forward.</p>
<h3>Year 1 · 2026–27</h3>
<ul><li>Constitution ratified; recognised by Student Life</li><li>Council of 8 seated; first Open Call</li><li>All four standing programmes deliver: Second Chapter Ed. 1, Side Quest pilot, Waraq Issue 1, Typewriter Tour</li><li>Monthly Majlis from December</li><li>First elections and a clean handover</li><li>60 registered members, 25 voting</li></ul>
<h3>Year 2 · 2027–28</h3>
<ul><li>All 10 Council seats filled by students who joined after founding</li><li>Waraq Issues 2 and 3; Side Quest Season 1 in full</li><li>First one-act festival; Motion Night; Bad Poetry Night</li><li>SAL Prizes launched</li><li>Alumni Circle and the first reunion at Charter Night</li><li>120 members, 45 voting; 5 active club partners</li></ul>
<h3>Year 3 · 2028–29 · Institution</h3>
<ul><li>A full theatre production</li><li>An inter-university student letters day with other Baghdad universities</li><li>A Waraq issue fund that pays for the next issue in advance</li><li>Handbooks reviewed and reissued by a Council that never met the founder</li><li>200 members, 70 voting</li><li>SAL named in AUIB welcome materials as a campus tradition</li></ul>
<h2>The one test that matters</h2>
<p>In October 2029, will Charter Night be run by people who never met the founder, with more members than the year before and a programme nobody on the founding team imagined? If yes, the plan worked.</p>
<h2>Measures</h2>
<p>Targets are estimates for a new society and will be reset each April against real numbers. The KPI tab in the Operations Tracker fills in the actuals.</p>
<table><thead><tr><th>MEASURE</th><th>YEAR 1</th><th>YEAR 2</th><th>YEAR 3</th><th>OWNER</th></tr></thead><tbody><tr><td><strong>Registered members</strong></td><td>60</td><td>120</td><td>200</td><td>Membership</td></tr><tr><td><strong>Voting (active) members</strong></td><td>25</td><td>45</td><td>70</td><td>Membership</td></tr><tr><td><strong>Two-semester retention</strong></td><td>50%</td><td>60%</td><td>65%</td><td>Membership</td></tr><tr><td><strong>Council seats filled</strong></td><td></td><td>10 / 10 + deputies</td><td></td><td>President</td></tr><tr><td><strong>Events held per semester</strong></td><td>6</td><td>10</td><td>14</td><td>Programmes</td></tr><tr><td><strong>Average Majlis attendance</strong></td><td>15</td><td>25</td><td>35</td><td>Letters</td></tr><tr><td><strong>Waraq submissions per issue</strong></td><td>80</td><td>100</td><td>120</td><td>Waraq EIC</td></tr><tr><td><strong>Arabic share of Waraq pages</strong></td><td>25%</td><td>35%</td><td>40%</td><td>Waraq EIC</td></tr><tr><td><strong>Side Quest episodes released</strong></td><td>1 (pilot)</td><td>6</td><td>12</td><td>Media</td></tr><tr><td><strong>Second Chapter raised (IQD)</strong></td><td>1.5M</td><td>2M</td><td>2.5M</td><td>Partnerships</td></tr><tr><td><strong>Volunteer hours logged</strong></td><td>600</td><td>1,200</td><td>2,000</td><td>Membership</td></tr><tr><td><strong>Club partners with an MoU</strong></td><td>3</td><td>5</td><td>8</td><td>Partnerships</td></tr><tr><td><strong>Ledger matches receipts at Audit</strong></td><td>100%</td><td>100%</td><td>100%</td><td>Treasurer</td></tr><tr><td><strong>Minutes sent within 72 h</strong></td><td>90%</td><td>95%</td><td>95%</td><td>General Secretary</td></tr><tr><td>Second Chapter targets follow its proposal (1.5M IQD illustrative). Waraq targets follow its plan of record (80+ submissions, 25% Arabic pages).</td><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>Resources</h2>
<p>A modest core budget for the Society itself. The standing programmes carry their own budgets, set out in their proposals.</p>
<h4>Core budget, Year 1 (estimate, IQD)</h4>
<table><thead><tr><th>LINE</th><th>BASIS</th><th>IQD</th></tr></thead><tbody><tr><td><strong>Majlis: tea, printing, guest thank-you gifts</strong></td><td>8 × 320,000 40,000</td><td></td></tr><tr><td><strong>Open Pages workshops: materials</strong></td><td>4 × 60,000 15,000</td><td></td></tr><tr><td><strong>Welcome evenings</strong></td><td>2 × 150,000 75,000</td><td></td></tr><tr><td><strong>Charter Night</strong></td><td>1 250,000</td><td></td></tr><tr><td><strong>AGM, elections and the Ribbon</strong></td><td>1 100,000</td><td></td></tr><tr><td><strong>Print: term cards, membership cards, certificates</strong></td><td>200,000</td><td></td></tr><tr><td><strong>Typewriter: ribbons, paper, servicing</strong></td><td>50,000</td><td></td></tr><tr><td><strong>Contingency (10%)</strong></td><td>113,000</td><td></td></tr><tr><td><strong>Total core</strong></td><td>1,243,000</td><td></td></tr><tr><td>Estimates, not quotes. The Treasurer replaces them with real prices in the Tracker before the budget is adopted.</td><td></td><td></td></tr></tbody></table>
<h4>Programme budgets (from their plans)</h4>
<table><tbody><tr><td><strong>Waraq Issue 1</strong></td><td>~2,500,000</td></tr><tr><td><strong>Side Quest pilot</strong></td><td>~200,000 running</td></tr><tr><td><strong>Second Chapter</strong></td><td>costs only; proceeds go to the charity</td></tr><tr><td><strong>Typewriter Tour</strong></td><td>to be planned</td></tr></tbody></table>
<h4>Where money comes from</h4>
<ul><li>Student Life support for recognised societies (to be requested)</li><li>Waraq copy sales into the Issue fund</li><li>Partners and sponsors under the Partnerships Policy, from Year 2</li><li>In-kind: rooms, printing, faculty time</li></ul>
<p><strong>Never</strong> membership fees</p>
<h2>People are the real budget</h2>
<p>Year 1 needs about 18 people in Society roles plus the programme teams, roughly 60 hours of volunteer time a week in term. The Open Call, the Apprenticeship and recognition are how we pay for it.</p>
<h2>Risks</h2>
<p>The risks to the Society itself. Each programme keeps its own risk register.</p>
<table><thead><tr><th>RISK</th><th>LEVEL</th><th>WHAT WE DO ABOUT IT</th></tr></thead><tbody><tr><td><strong>The founder graduates and energy leaves with them</strong></td><td>High</td><td>Elections in April 2027; a Founding Advisor year; handover dossiers; Year 2 Council fully post-founding</td></tr><tr><td><strong>Too many programmes for too few people</strong></td><td>High</td><td>Staffing by stage; the smallest working Society; the Council says no to new programmes until seats are filled</td></tr><tr><td><strong>A few people do everything and burn out</strong></td><td>Medium</td><td>Two roles at most; honest hours; step-back always allowed; deputies named</td></tr><tr><td><strong>Approvals arrive late and events slip</strong></td><td>Medium</td><td>The General Secretary as single contact; lead times in the Playbook; Plan B dates in each programme</td></tr><tr><td><strong>Content upsets someone on a sensitive subject</strong></td><td>Medium</td><td>Expression &amp; Content Policy; editorial independence with clear limits; Faculty Advisor and Advisory Board</td></tr><tr><td><strong>Money is lost or questioned</strong></td><td>Low</td><td>Two-person cash rule; receipts in 48 h; semester Audit; charity money kept separate</td></tr><tr><td><strong>Membership stays within one college or language</strong></td><td>Medium</td><td>Outreach through partner clubs; Arabic and English in everything; Bad Poetry Night as a low-barrier door</td></tr></tbody></table>
<h2>Keeping the Plan Alive</h2>
<p>A plan that is read once is a brochure. This one is reviewed on a fixed rhythm.</p>
<table><thead><tr><th>WHEN</th><th>WHAT</th><th>WHO</th></tr></thead><tbody><tr><td><strong>Every Council meeting</strong></td><td>Programme updates against the Term Card</td><td>Directors, chairs</td></tr><tr><td><strong>End of each semester</strong></td><td>Semester report (F-25) with the measures; one page to Student Life</td><td>President, General Secretary</td></tr><tr><td><strong>April, at the AGM</strong></td><td>Annual Report; next year’s targets proposed</td><td>President</td></tr><tr><td><strong>First week of fall term</strong></td><td>Planning retreat: budget, calendar, work plans, targets adopted</td><td>New Council</td></tr><tr><td><strong>Spring 2029</strong></td><td>A new three-year plan, written by members who were not founders</td><td>Council</td></tr></tbody></table>
<p><strong>Decisions for the founding team before Charter Day:</strong> the motto; the Arabic name; the founding date to record in the Constitution; the three founding officers; the Faculty Advisor; and whether the Stage &amp; Arts and Partnerships seats stay combined for Year 1.</p>
$doc$),
  ('member-handbook', 'SAL-MEM-01', 'Member Handbook', 'دليل العضو', 'Everything a new member needs to know, in eleven pages.', 'public', 'adopted', null, '2026-09-28', null, null, 60,
   $doc$<p><strong>A LETTER FROM THE FOUNDER</strong></p>
<h2>Welcome.</h2>
<p>You are now part of the Society of Arts and Letters. We started SAL because this campus is full of people who write in the margins of their notebooks, sing on the bus, sketch in lectures and read on their phones at midnight, and there was nowhere to bring all of that together.</p>
<p>SAL is that place. You do not need to be a writer, an actor or an artist to belong here. You only need to be curious. Some of our best members come to listen, some come to argue, and some come because a friend dragged them to a Bad Poetry Night and they never left.</p>
<p>Everything we do is free, in Arabic and English, and open to every student. We have a Constitution now, and elections, and a Council, because we want this Society to be here long after the people who started it have graduated. That means it will one day be yours to run.</p>
<p>Come to a Majlis. Type your six words on the typewriter. Tell us what you want to make. We will help you make it.</p>
<p>Shaheen Farjo</p>
<p>Founder &amp; President, Society of Arts and Letters</p>
<h2>What SAL Is</h2>
<p>A student society that exists to cultivate a culture of literature and creative expression across AUIB.</p>
<h4>Connecting students</h4>
<p>From every college, into one room and onto one page.</p>
<h4>Fostering creativity</h4>
<p>Deadlines, editors and stages that turn drafts into finished work.</p>
<h4>Celebrating culture</h4>
<p>Arabic and English side by side; Iraqi writing next to world writing.</p>
<h4>Building a community</h4>
<p>A society people stay in, and come back to.</p>
<p><strong>OUR MOTTO</strong></p>
<p><span lang="ar">والقرطاسُ والقلم</span> · The paper and the pen</p>
<p>From al-Mutanabbi, the Abbasid poet whose name the book street of Baghdad carries.</p>
<h2>What We Do</h2>
<p>Four big programmes and a rhythm of small ones. The Term Card lists this semester’s dates.</p>
<p><strong>Waraq</strong></p>
<p>Our bilingual literary journal (working title). Submit, or join the masthead.</p>
<p><strong>Side Quest</strong></p>
<p>Our campus video series (working title). Be a guest, or join the crew.</p>
<p><strong>Second Chapter</strong></p>
<p>Every fall: donate books, volunteer at the fair, keep a child warm.</p>
<p><strong>Typewriter Tour</strong></p>
<p>Every spring: six words, one typewriter, the whole campus.</p>
<p><strong>The Majlis</strong></p>
<p>Monthly salon: a guest, readings, tea, conversation.</p>
<p><strong>Open Pages</strong></p>
<p>Writing workshops with editors on hand.</p>
<p><strong>Book Circle</strong></p>
<p>One book a month, Arabic and English in turn.</p>
<p><strong>Scratch Night</strong></p>
<p>Try a scene, a poem or a sketch. No pressure.</p>
<p><strong>Bad Poetry Night</strong></p>
<p>The worst poem at AUIB wins. Really.</p>
<p><strong>Motion Night</strong></p>
<p>A literary debate once a term.</p>
<p><strong>Gallery Wall</strong></p>
<p>Your art and photography, on the wall.</p>
<p><strong>The Mutanabbi Walk</strong></p>
<p>A trip to Baghdad’s book street (with approval).</p>
<h2>Joining</h2>
<p>Membership is free and open to every AUIB student. There is no audition, no portfolio and no fee.</p>
<h4>1 · Register</h4>
<p>Fill in the registration form (scan the QR on any SAL poster, or ask at any event). Sign the Member Pledge.</p>
<h4>2 · Join The Common Room</h4>
<p>Our Telegram channel, where reminders and room changes go first. Follow @auibsal too.</p>
<h4>3 · Come to two things</h4>
<p>Any two Society activities in a semester make you a <strong>Voting Member</strong>: you can vote in elections and stand for office.</p>
<table><thead><tr><th>YOU ARE A…</th><th>IF YOU…</th><th>YOU CAN…</th></tr></thead><tbody><tr><td><strong>Member</strong></td><td>have registered</td><td>take part in everything, pitch ideas, apply for roles</td></tr><tr><td><strong>Voting Member</strong></td><td>took part in two activities this or last semester</td><td>also vote and stand for election</td></tr><tr><td><strong>Fellow</strong></td><td>gave outstanding service, named by the Council</td><td>keep the title for life; your name in the Book of Fellows</td></tr><tr><td><strong>Honorary Member</strong></td><td>are faculty, staff, an alumnus or a guest artist honoured by the Council</td><td>join us as a friend and guest (no vote)</td></tr><tr><td><strong>Alumni Member</strong></td><td>have graduated</td><td>come back to Charter Night and mentor</td></tr></tbody></table>
<h2>Our Traditions</h2>
<p>Small rituals that make a society feel like one. Anyone can join in.</p>
<h4>Six words</h4>
<p>Every new member types six words on the Society Typewriter. The page goes into the Book of Members, forever.</p>
<h4>The Founders’ Roll</h4>
<p>The names of those who adopted the Constitution on Charter Day, October 13, 2026.</p>
<h4>Charter Night</h4>
<p>Every October, our anniversary: readings, the year’s new members, and cake.</p>
<h4>The Term Card</h4>
<p>Each semester’s programme on one printed card. Keep it in your wallet.</p>
<h4>The Ribbon</h4>
<p>Every April the outgoing President gives the new President a fresh ribbon for the typewriter.</p>
<h4>Tea at the Majlis</h4>
<p>There is always tea. Faculty come as readers, not lecturers.</p>
<h2>Your first month</h2>
<p>Register · join The Common Room · type your six words · come to a Majlis with your buddy · tell us after your second event what you would like to do here.</p>
<h2>Getting Involved</h2>
<h4>Take a role</h4>
<p>Twice a year we run an <strong>Open Call</strong> for every role: directors, coordinators, the Waraq masthead, the Side Quest crew, event volunteers. Anyone can apply, member or not. Team roles start with a three-week <strong>Apprenticeship</strong>: one real task, one mentor, then a free choice.</p>
<h4>Stand for election</h4>
<p>Every April, Voting Members elect the President, Vice President, General Secretary and Treasurer. Candidates read a six-word vision at the Candidates’ Reading.</p>
<h4>Volunteer for one evening</h4>
<p>Every event needs hands. Tell the Volunteer Coordinator; hours are logged and count towards a certificate and a Fellowship.</p>
<h4>Pitch an idea</h4>
<p>Want to run a poetry slam, a film night, a translation workshop? Any member can pitch a programme.</p>
<ul><li>Fill in the one-page Programme Pitch (F-10)</li><li>Say which pillar it serves and who will help you</li><li>Send it to the director closest to your idea</li><li>They bring it to the Council within two meetings</li><li>If it is greenlit, you lead it, with a budget and support</li></ul>
<p>If the answer is “not yet”, you will get the reasons in writing and what would change them.</p>
<h3>Recognition</h3>
<h4>Credit</h4>
<p>Your name in the programme, the masthead or the credits of anything you worked on.</p>
<h4>Certificate of service</h4>
<p>For every role completed, signed by the President and the Faculty Advisor.</p>
<h4>Fellowship</h4>
<p>For forty hours of service in a year, leading a programme, or exceptional work.</p>
<h2>Our Promises</h2>
<h4>What we promise you</h4>
<ul><li>Everything is free, or has a free way to take part</li><li>Arabic and English are both welcome, everywhere</li><li>Your work stays yours; we credit you by name</li><li>No photo of you goes online if you said no. Ask and it comes down within 24 hours</li><li>Your data is seen only by those who need it and deleted after you leave</li><li>Every dinar is counted twice and reported</li><li>You can raise a concern without fear, and you will be answered within 14 days</li></ul>
<h4>What we ask of you</h4>
<ul><li>Treat everyone with courtesy</li><li>Critique the work, never the person</li><li>Respect consent, on camera and on the page</li><li>Keep confidential what is confidential</li><li>Keep your word, or say early that you cannot</li><li>No alcohol, drugs or weapons at Society activities</li><li>Leave every room better than you found it</li></ul>
<p><strong>If something is wrong,</strong> tell any officer, our Faculty Advisor or the Office of Student Life, in person or with the concern form. Harassment, safety and anything involving a child go straight to Student Life. The full rules are in the Policy Manual; the short version is the Member Pledge you signed.</p>
<p><strong>Our Society is non-partisan and non-sectarian.</strong> Your writing and art can explore anything human. The Society itself takes no side in party or sect.</p>
<h2>Questions</h2>
<h4>Do I need to be good at writing?</h4>
<p>No. You need to be curious. Half our members come to listen.</p>
<h4>Is it only in English?</h4>
<p>No. Arabic and English stand on equal footing in everything we do.</p>
<h4>How much time does it take?</h4>
<p>As much as you like. A member can come once a month; a coordinator gives two or three hours a week.</p>
<h4>I’m in engineering / business / IT. Is this for me?</h4>
<p>Yes. We need designers, treasurers, filmmakers, organisers and readers from every college.</p>
<h4>Can I submit to Waraq if I’m on the team?</h4>
<p>Yes, blind and never to a section you read or edit. Waraq’s guidelines have the details.</p>
<h4>Who runs SAL?</h4>
<p>A Council of four elected officers and six directors, answerable to all members through the General Assembly.</p>
<h4>How do I leave?</h4>
<p>Tell the Director of Membership. You can always come back.</p>
<p><strong>Instagram</strong> @auibsal · <strong>Telegram</strong> The Common Room · <strong>Email</strong> [Society AUIB email]</p>
$doc$),
  ('founding-proposal', 'SAL-PRP-01', 'Founding the Society', 'تأسيس الجمعية', null, 'internal', 'draft', null, null, null, null, 110,
   ''),
  ('operations-playbook', 'SAL-OPS-01', 'Operations Playbook', 'دليل العمليات', null, 'internal', 'draft', null, null, null, null, 120,
   ''),
  ('templates-and-forms', 'SAL-OPS-02', 'Templates & Forms', 'النماذج والقوالب', null, 'internal', 'draft', null, null, null, null, 130,
   ''),
  ('printables', 'SAL-PRT-01', 'Printables', 'المطبوعات', null, 'internal', 'draft', null, null, null, null, 140,
   '');

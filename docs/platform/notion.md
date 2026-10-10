# The team's Notion workspace

The officers' working space is the Notion workspace **AUIB Society of Arts
and Letters**, teamspace **HQ** (Notion Plus for education clubs). Team work
lives there; anything that needs privacy between people, a tamper-proof
record or members taking part lives in the Nexus. Nothing is kept in both.

## What lives where

| In Notion (the only home) | In the Nexus (the only home) |
| --- | --- |
| Projects, tasks, meetings (agendas, working notes) | Members, verification, roles |
| Events and news: written and published from Notion | RSVPs, check-in, the waitlist |
| The content calendar (Instagram, newsletters) | Elections and ballots |
| The officer handbook and the internal documents | Journal submissions and blind review |
| | The charity ledger, certificates, service hours |
| | Forms (including confidential ones), adopted minutes, foundational documents |

Notion also holds **read-only copies** ("From the Nexus"): the officer
directory, programs, the document and minutes registry, and Journal counts
per stage (numbers only; review is blind). Edit them in the Nexus; each row
links there.

## How the sync works

`apps/api` route `/cron/notion-sync`, called by pg_cron (`sal-notion-sync`)
every five minutes with the cron secret:

1. **Mirrors.** Programs, officers (`access.officer_directory()`), documents
   and minutes, Journal stage counts. A row is written only when it changed
   (hash in `core.notion_links`) and moved to the trash when its record is
   gone. Officers are matched to Notion people by AUIB email.
2. **Publishing.** Pages in Events or Content calendar (kind News post) with
   Status **Ready to publish** are checked (`lib/notion/rules.ts`): titles in
   both languages, a start time, lengths, slug, program. The page's last
   editor is matched by email and must hold `events.manage` or
   `content.manage` (`access.notion_publisher()`; roles that need two-step
   sign-in count only when that account has a verified second factor). The
   text is read from the page under the headings **English** and **العربية**,
   converted to HTML and sanitized; the first image is copied to the media
   bucket. The page gets Status **Published**, the Nexus and public links and
   a note; problems set **Needs changes**, a note and a comment.
   **Cancel on the site** cancels a published event.
3. **Nexus items.** Events and news made in the Nexus get a page in Notion
   too (their text stays in the Nexus until written in the page; an empty
   page never blanks it).
4. **RSVP counts** go back to each event's page.

The result is stored in `core.settings` `notion.sync_state` and shown in
Administration → Settings → Notion, with who to invite to and remove from
the workspace (Notion's API cannot invite people).

## Setup (done once)

1. Notion → Settings → Connections → Develop or manage integrations → new
   connection **SAL Platform**, authentication **API token**. Under its
   capabilities, allow **Read user information including email addresses**
   (without it nothing can be published: the platform cannot tell who set
   Ready to publish).
2. Vercel → **sal-api** → Environment Variables: `NOTION_TOKEN` (Production
   and Preview). Never in `app` or `web`.
3. In Notion, on **Start here**: ••• → Connections → add **SAL Platform**.
4. The databases' ids are in `core.settings` `notion.data_sources` (migration
   `20261010000300`). If a database is recreated, update that setting.

## Rules

- Never rename the properties the sync reads or writes (Title, Title
  (Arabic), Status and its options, When, Summary, Nexus ID, …); add new ones
  freely.
- Do not turn on the allowed email domain setting for auib.edu.iq: it would
  let every AUIB student and staff member into the workspace.
- Volunteers (rotas, crews) are added as **guests** on their project's pages
  only.
- Never put member records, RSVPs by name, ballots, submissions or authors,
  ledger entries, certificates or confidential forms in Notion.

## When something is wrong

- **Nothing publishes; pages say the platform could not see who set the
  status:** step 1's email capability is off.
- **Settings shows "Not connected":** `NOTION_TOKEN` is missing on sal-api.
- **A database stops syncing:** a property was renamed or the page is no
  longer shared with SAL Platform; the problem list in Settings names it.

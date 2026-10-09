# Sign in with SAL and the API

How apps outside the Nexus sign members in and work with the AUIB Literary Journal, and what keeps that safe.

Apps outside the Nexus, such as a Journal team's own tool, can sign members in with their Society account and act for them through the API at `api.auibsal.org/v1`. The Society approves each app and decides what it may reach. Members choose whether to allow it, and can disconnect it at any time.

It costs nothing: sign-in is the Supabase OAuth 2.1 server (free on every plan while in beta) and the API runs on the existing `apps/api`.

## How it fits together

1. **The app sends the member to sign in.** A standard OAuth 2.1 authorization-code flow with PKCE, to `https://fghzahtzgelqnpwdhwjo.supabase.co/auth/v1/oauth/authorize`. OpenID Connect discovery is at `/auth/v1/.well-known/openid-configuration` on the same host.
2. **The member allows it in the Nexus.** Supabase sends them to `nexus.auibsal.org/oauth/consent`. The page names the app and lists what it can do. Apps the Society has not approved can only be refused.
3. **The app gets tokens.** It exchanges the code at `/auth/v1/oauth/token` for an access token (one hour) and a refresh token.
4. **The app calls the API as the member.** `Authorization: Bearer <access token>` on `https://api.auibsal.org/v1/...`. Each request runs as that member, so they can do only what they could do in the Nexus.

## What keeps it safe

An OAuth access token is an ordinary member token plus a `client_id` claim. OAuth scopes (`openid`, `email`, `profile`, `phone`) only shape the ID token; they do not limit the data. So the limits live in the database, where the app cannot get round them:

- **Approved apps only.** An app must be listed in **Nexus → Administration → Settings → Third-party apps** and switched on. A token from any other app sees nothing and cannot call anything.
- **Areas.** Each listed app gets areas: name and language, the AUIB Literary Journal, events, programs, pages and news. Every table has a restrictive policy that keeps an app inside its areas. A pre-request check does the same for database functions, which skip row policies. Membership records, elections and ballots, the charity ledger and roles are never available to apps.
- **Member rules still apply.** Inside its areas an app can do only what the member could. Blind review holds: readers get a blind id and the text, never the author.
- **The Society's own endpoints refuse app tokens.** Account deletion, exports, signed file links and push tests answer the Nexus only. App tokens work on `/v1` alone.
- **Two-step sign-in.** Roles that need it (editors deciding, officers) count only on an `aal2` session, so an editor using an app may be asked to finish two-step sign-in first.
- **Disconnect.** Members disconnect an app in **Profile and privacy → Connected apps**; officers switch an app off for everyone in Settings. Either ends its access at once.

> **Warning.** An app holding a member's token can also call Supabase Auth as that member (for example to change their password), as the Nexus can. Approve only apps run by people the Society trusts, and keep **dynamic client registration off**.

## API reference (v1)

Bearer tokens only, never cookies; any origin may call it. Errors are JSON `{ "error": "<code>", "detail": ... }` with 400 (invalid input), 401 (no or bad token), 403 (not allowed), 404, 409 (conflict) or 500.

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /v1` | Anyone | This list, and the sign-in endpoints |
| `GET /v1/me` | Member | Id, email, name and language (needs the profile area), permissions |
| `GET /v1/journal/calls` | Anyone | Calls open now, and announced ones |
| `GET /v1/journal/issues` | Anyone | Published issues |
| `GET /v1/journal/submissions` | Member | The member's own submissions and their status |
| `POST /v1/journal/submissions` | Member | Submit a text piece to an open call. Body: `call_id`, `category`, `language`, `title`, `body_html`, `human_authorship_confirmed: true`; translations also `source_text`, `source_author`, `rights_note` |
| `POST /v1/journal/submissions/{id}/transition` | Member or editor | Move a submission (`to`, optional `note`): withdraw, or intake moves for editors |
| `GET /v1/journal/reviews` | Reader | Entries assigned to the member, blind, with their scores so far |
| `POST /v1/journal/reviews/{assignment}/score` | Reader | Score on the rubric: `craft`, `voice`, `depth`, `archive_factor` (1–5), `comment` |
| `GET /v1/journal/entries?issue={id}` | Editor, Advisory Board | Blind entries the member may see, with reads, scores and decisions |
| `POST /v1/journal/entries/{id}/decision` | Editor (`journal.decide`) | `accept`, `accept_with_edits` or `decline`, with `notes`. The author is told by email and phone notification |

The database enforces the call window, the limit per member, the rubric and who may make which move. The API adds no rules of its own.

## Setting up an app

1. **Turn on the OAuth server (once).** Supabase → Authentication → OAuth Server: on, authorization path `/oauth/consent`, dynamic registration off. Authentication → URL Configuration: Site URL `https://nexus.auibsal.org`. For OpenID Connect ID tokens, switch the project to asymmetric JWT signing keys (Settings → JWT Keys).
2. **Register the app.** Authentication → OAuth Apps → Add: the app's name, its redirect URLs, and its type: **public** for apps that run in a browser or on a phone (PKCE, no secret), **confidential** for apps with a server that can keep a secret. Send the client id (and secret, if any) to the app's team privately.
3. **Approve it in the Nexus.** Administration → Settings → Third-party apps → Add an app: the client id, the name, a contact email, and the areas it needs. A Journal team's tool needs **Name and language** and **AUIB Literary Journal**.

## What comes next

Ready now: sign-in, the member's profile and permissions, calls and issues, submitting text, the member's submissions, reading and scoring, and editorial decisions. Functions in the Journal area (assigning readers, returning for formatting) are also open to approved Journal apps through Supabase directly.

Not yet, and what each needs:

- **File submissions:** a `/v1` endpoint that issues signed upload links to the private bucket (apps never reach Storage directly).
- **Publishing issues and pieces:** `journal.publish` endpoints, plus the editors' sign-off that apps may publish.
- **Signing the Publication Agreement:** the agreement text first (`TODO(content)` in PROGRESS.md).
- **Telling the app when things change:** signed webhooks from the outbox to the app, with a secret per app.
- **An OpenAPI description** of `/v1`, generated from the route schemas.
- **Custom scopes** (for example "read only"), when Supabase supports them; until then the Society's areas are the limit.

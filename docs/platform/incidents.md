# When something breaks

Where alerts come from, where to look first, and who to tell.

| Signal | Comes from | Look at |
| --- | --- | --- |
| A site is down | BetterStack monitors: auibsal.org/en, the Nexus sign-in page, api.auibsal.org/health | The Vercel project's latest deployment, then Supabase status |
| Errors for members | Sentry (projects sal-web, sal-nexus, sal-api) | The issue's stack trace and the release it started in |
| Emails not arriving | Resend logs | Whether the outbox is draining: rows in `core.outbox` with no `processed_at` |
| A deploy failed | Vercel and GitHub checks on the pull request | The build log |
| A migration failed | GitHub → Actions → Migrate production database | The failing statement; fix with a new migration |

## First steps

1. **Is it everyone or one person?** Try it signed out, then signed in with a test account.
2. **Did something just change?** If a deploy went out in the last hour, [roll it back](releases.md#if-a-release-breaks-something) first and investigate after.
3. **Is it a permission?** In the Nexus, most "can't see it" reports are a missing role or a missing two-step sign-in, not a fault. See [Signing in](https://nexus.auibsal.org/en/handbook?page=sign-in).
4. **Tell people.** Post a short note in the Council group: what is broken, since when, and when you will update next.

## Data or safety incidents

If member data may have been exposed, or someone may be at risk, tell the President and the Faculty Advisor the same day (Policy P3.4, P6). Record what happened, when, and what was done. Under Policy P13.5, incidents are recorded within 24 hours.

# Notifications

Email and phone notifications, and what each costs.

Every notice (bookings, reminders, Journal receipts and decisions, role endings, removal requests) goes by **email** through Resend. Members who turn on **phone notifications** also get it on their phones and computers. Both are free.

## Phone notifications

Standard Web Push, with no vendor in between: the browser makers' push services deliver them, and `apps/api` signs each one with the Society's VAPID key.

- Members turn them on per device in **Profile and privacy → Phone notifications**, and can send themselves a test.
- **iPhone and iPad** (iOS 16.4 or later) show them only when the Nexus is added to the Home Screen: Share → Add to Home Screen, then open it from there. Android and computers work in the browser.
- Signing out removes the device, so a shared computer never shows the last member's notices.
- A notice goes to devices after its email. If a push fails, the email is still the record; devices their push service reports gone are removed.

### Keys

Generate the pair once with `bunx web-push generate-vapid-keys`.

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | sal-nexus and sal-api |
| `VAPID_PRIVATE_KEY` | sal-api only |

Without them, the Profile section says the browser can't show notifications, and everything still goes by email. Changing the keys signs every device out of notifications; members turn them on again.

## Email limits

Resend's free plan sends 100 emails a day and 3,000 a month. When the day's limit is spent, the outbox waits for it to reset instead of using up its retries, and each email carries an idempotency key so a retry never sends twice.

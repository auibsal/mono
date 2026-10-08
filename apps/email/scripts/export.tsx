/**
 * Renders every platform email, in both languages, to static HTML in `out/`
 * with an index page: the officers' preview of what members receive. The
 * words come from @repo/email/copy, the same builders apps/api sends with.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@react-email/components";
import {
  agreementReminder,
  type Built,
  decision,
  type EventInfo,
  eventReminder,
  type Lang,
  type RemovalInfo,
  type RoleInfo,
  removalReceived,
  removalRequested,
  returnedForFormatting,
  roleEnding,
  rsvpConfirmed,
  submissionReceived,
  waitlistPromoted,
} from "@repo/email/copy";
import { Notice } from "@repo/email/templates/notice";

const APP = "https://nexus.auibsal.org";
const OUT = fileURLToPath(new URL("../out", import.meta.url));

const event: EventInfo = {
  starts_at: "2026-10-13T15:00:00Z",
  title_ar: "صفحات مفتوحة",
  title_en: "Open Pages",
  venue_ar: "مكتبة الجامعة",
  venue_en: "University Library",
};
const role: RoleInfo = {
  ends_at: "2027-05-13T20:59:59Z",
  name_ar: "مدير الفعاليات",
  name_en: "Director of Programs and Events",
};
const removal: RemovalInfo = {
  content_url: "https://auibsal.org/en/news/example",
  details: "Please remove the photo of me from this post.",
  due_at: "2026-10-09T15:00:00Z",
  requester_email: "member@auib.edu.iq",
  requester_name: "A Member",
};
const WORK = "The paper and the pen";

const emails: Record<string, (lang: Lang) => Built> = {
  "agreement-reminder": (l) => agreementReminder(l, WORK, APP),
  "decision-accept": (l) => decision(l, WORK, "accept", APP),
  "decision-accept-with-edits": (l) =>
    decision(l, WORK, "accept_with_edits", APP),
  "decision-decline": (l) => decision(l, WORK, "decline", APP),
  "event-reminder": (l) => eventReminder(l, event, APP),
  "removal-overdue": (l) => removalRequested(l, removal, APP, true),
  "removal-received": (l) => removalReceived(l, removal.due_at),
  "removal-requested": (l) => removalRequested(l, removal, APP),
  "returned-for-formatting": (l) =>
    returnedForFormatting(l, WORK, "Please send it as one document.", APP),
  "role-ending": (l) => roleEnding(l, role, APP),
  "rsvp-confirmed": (l) => rsvpConfirmed(l, event, APP),
  "submission-received": (l) => submissionReceived(l, WORK, APP),
  "waitlist-promoted": (l) => waitlistPromoted(l, event, APP),
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const main = async () => {
  await rm(OUT, { force: true, recursive: true });
  await mkdir(OUT, { recursive: true });
  const rendered = await Promise.all(
    Object.entries(emails).map(async ([name, make]) => {
      const links = await Promise.all(
        (["en", "ar"] as const).map(async (lang) => {
          const built = make(lang);
          const file = `${name}.${lang}.html`;
          await writeFile(join(OUT, file), await render(<Notice {...built} />));
          return `<a href="${file}" lang="${lang}">${escapeHtml(built.subject)}</a>`;
        })
      );
      return `<li><code>${name}</code><br>${links.join(" · ")}</li>`;
    })
  );
  const rows = rendered;
  await writeFile(
    join(OUT, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>SAL emails</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#273236;background:#fff}li{margin:0 0 1rem}a{color:#9c213e}</style></head><body><h1>Emails the Nexus sends</h1><p>Each notice in the recipient's language first, then the other. Sample data.</p><ul>${rows.join("")}</ul></body></html>`
  );
  console.log(`Rendered ${rows.length * 2} emails to ${OUT}`);
};

await main();

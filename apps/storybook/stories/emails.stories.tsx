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
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Every email the platform sends, rendered from the same @repo/email/copy
 * builders apps/api sends with, in English and Arabic. Sample data only.
 */
const meta = {
  title: "SAL/Emails",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const APP = "https://nexus.auibsal.org";
const WORK = "The paper and the pen";
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

const LANGS = ["en", "ar"] as const;

/** Both languages side by side, each in its own frame like a mail client. */
const email = (make: (lang: Lang) => Built): Story => ({
  loaders: [
    async () => ({
      html: await Promise.all(
        LANGS.map((lang) => render(<Notice {...make(lang)} />))
      ),
    }),
  ],
  render: (_args, { loaded }) => (
    <div className="grid gap-6 md:grid-cols-2">
      {LANGS.map((lang, i) => (
        <figure className="grid gap-2" key={lang}>
          <figcaption className="type-caption">{make(lang).subject}</figcaption>
          <iframe
            className="h-[720px] w-full rounded-lg border border-rule"
            srcDoc={(loaded.html as string[])[i]}
            title={make(lang).subject}
          />
        </figure>
      ))}
    </div>
  ),
});

export const AgreementReminder = email((l) => agreementReminder(l, WORK, APP));
export const DecisionAccept = email((l) => decision(l, WORK, "accept", APP));
export const DecisionAcceptWithEdits = email((l) =>
  decision(l, WORK, "accept_with_edits", APP)
);
export const DecisionDecline = email((l) => decision(l, WORK, "decline", APP));
export const EventReminder = email((l) => eventReminder(l, event, APP));
export const RemovalOverdue = email((l) =>
  removalRequested(l, removal, APP, true)
);
export const RemovalReceived = email((l) => removalReceived(l, removal.due_at));
export const RemovalRequested = email((l) => removalRequested(l, removal, APP));
export const ReturnedForFormatting = email((l) =>
  returnedForFormatting(l, WORK, "Please send it as one document.", APP)
);
export const RoleEnding = email((l) => roleEnding(l, role, APP));
export const RsvpConfirmed = email((l) => rsvpConfirmed(l, event, APP));
export const SubmissionReceived = email((l) =>
  submissionReceived(l, WORK, APP)
);
export const WaitlistPromoted = email((l) => waitlistPromoted(l, event, APP));

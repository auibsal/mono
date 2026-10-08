import { formatClock, formatLongDate } from "@repo/internationalization/format";
import type { NoticeBlock, NoticeProps } from "./templates/notice";

/**
 * The words of every platform email, in both languages. Arabic here was
 * written for the platform (needs-native-review in PROGRESS.md).
 */
export type Lang = "en" | "ar";

interface Copy {
  action?: { href: string; label: string };
  heading: string;
  paragraphs: string[];
}

export interface Built extends NoticeProps {
  subject: string;
}

const other = (lang: Lang): Lang => (lang === "ar" ? "en" : "ar");

/** Builds the notice: the recipient's language first, then the other. */
const build = (lang: Lang, make: (l: Lang) => Copy): Built => {
  const first = make(lang);
  const blocks: NoticeBlock[] = [lang, other(lang)].map((l) => ({
    lang: l,
    ...make(l),
  }));
  return { blocks, preview: first.heading, subject: first.heading };
};

const when = (iso: string, l: Lang) =>
  `${formatLongDate(iso, l)} · ${formatClock(iso, l)}`;

const nexus = (base: string, l: Lang, path = "") => ({
  href: `${base}/${l}${path}`,
  label: l === "ar" ? "افتح النِّكسَس" : "Open the Nexus",
});

export interface EventInfo {
  starts_at: string;
  title_ar: string;
  title_en: string;
  venue_ar: string | null;
  venue_en: string | null;
}

const title = (e: EventInfo, l: Lang) => (l === "ar" ? e.title_ar : e.title_en);
const venue = (e: EventInfo, l: Lang) =>
  (l === "ar" ? e.venue_ar : e.venue_en) ??
  (l === "ar" ? e.venue_en : e.venue_ar);

const eventLines = (e: EventInfo, l: Lang) =>
  [when(e.starts_at, l), venue(e, l)].filter((x): x is string => Boolean(x));

export const rsvpConfirmed = (lang: Lang, e: EventInfo, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l),
    heading:
      l === "ar"
        ? `حُجز مكانك: ${title(e, l)}`
        : `You're booked: ${title(e, l)}`,
    paragraphs: [
      ...eventLines(e, l),
      l === "ar"
        ? "رمز تذكرتك في النِّكسَس. وإن تغيّرت خططك فألغِ الحجز هناك ليأخذ غيرك المكان."
        : "Your ticket code is in the Nexus. If your plans change, cancel there so someone else can have the place.",
    ],
  }));

export const waitlistPromoted = (lang: Lang, e: EventInfo, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l),
    heading:
      l === "ar"
        ? `أصبح لك مكان: ${title(e, l)}`
        : `A place opened up: ${title(e, l)}`,
    paragraphs: [
      ...eventLines(e, l),
      l === "ar"
        ? "كنت على قائمة الانتظار، وقد حُجز لك مكان الآن. رمز تذكرتك في النِّكسَس."
        : "You were on the waiting list and you now have a place. Your ticket code is in the Nexus.",
    ],
  }));

export const eventReminder = (lang: Lang, e: EventInfo, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l),
    heading: l === "ar" ? `غداً: ${title(e, l)}` : `Tomorrow: ${title(e, l)}`,
    paragraphs: [
      ...eventLines(e, l),
      l === "ar"
        ? "إن لم تعد تستطيع الحضور، فألغِ حجزك في النِّكسَس."
        : "If you can no longer come, cancel your place in the Nexus.",
    ],
  }));

export const submissionReceived = (lang: Lang, work: string, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l, "/journal"),
    heading: l === "ar" ? `وصلنا عملك: ${work}` : `We received ${work}`,
    paragraphs:
      l === "ar"
        ? [
            "يفحص مسؤول المشاركات التنسيق أولاً، ثم يقرأ القرّاء العمل قراءةً عمياء دون اسمك.",
            "يمكنك متابعة مراحل مشاركتك في النِّكسَس.",
          ]
        : [
            "The Submissions Manager checks formatting first; then readers read it blind, without your name.",
            "You can follow its progress in the Nexus.",
          ],
  }));

export const returnedForFormatting = (
  lang: Lang,
  work: string,
  note: string,
  app: string
) =>
  build(lang, (l) => ({
    action: nexus(app, l, "/journal"),
    heading:
      l === "ar"
        ? `يحتاج عملك إلى إصلاح في التنسيق: ${work}`
        : `${work} needs a formatting fix`,
    paragraphs: [
      ...(note ? [note] : []),
      l === "ar"
        ? "الأمر يتعلق بالتنسيق، لا بالحكم على العمل. عدّله في النِّكسَس ثم احفظ."
        : "This is about formatting, not a judgment of the work. Revise it in the Nexus and save.",
    ],
  }));

export type Decision = "accept" | "accept_with_edits" | "decline";

export const decision = (
  lang: Lang,
  work: string,
  outcome: Decision,
  app: string
) =>
  build(lang, (l) => {
    if (outcome === "decline") {
      return {
        heading:
          l === "ar" ? `شكراً لإرسالك ${work}` : `Thank you for sending ${work}`,
        paragraphs:
          l === "ar"
            ? [
                "لم يختر المحررون هذا العمل لمجلة AUIB الأدبية هذه المرة.",
                "نأمل أن نقرأ لك مجدداً في الدعوة القادمة.",
              ]
            : [
                "This time the editors have not selected it for the AUIB Literary Journal.",
                "We hope to read more of your work in the next call.",
              ],
      };
    }
    return {
      action: nexus(app, l, "/journal"),
      heading:
        l === "ar"
          ? `قُبل عملك في مجلة AUIB الأدبية: ${work}`
          : `${work} is accepted for the AUIB Literary Journal`,
      paragraphs: [
        ...(outcome === "accept_with_edits"
          ? [
              l === "ar"
                ? "قُبل مع تعديلات؛ سيتواصل معك المحررون بشأنها."
                : "It is accepted with edits; the editors will be in touch about them.",
            ]
          : []),
        l === "ar"
          ? "الخطوة التالية: وقّع اتفاقية النشر في النِّكسَس. لا يُنشر العمل قبل توقيعها."
          : "Next, sign the Publication Agreement in the Nexus. Nothing is published before it is signed.",
      ],
    };
  });

export const agreementReminder = (lang: Lang, work: string, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l, "/journal"),
    heading:
      l === "ar"
        ? `بانتظار توقيعك: اتفاقية نشر ${work}`
        : `Waiting for your signature: ${work}`,
    paragraphs: [
      l === "ar"
        ? "قُبل عملك في مجلة AUIB الأدبية، ولا يمكن نشره قبل أن توقّع اتفاقية النشر في النِّكسَس."
        : "Your work is accepted for the AUIB Literary Journal, and it cannot be published until you sign the Publication Agreement in the Nexus.",
    ],
  }));

export interface RoleInfo {
  ends_at: string;
  name_ar: string;
  name_en: string;
}

export const roleEnding = (lang: Lang, role: RoleInfo, app: string) =>
  build(lang, (l) => ({
    action: nexus(app, l),
    heading:
      l === "ar"
        ? `ينتهي دورك قريباً: ${role.name_ar}`
        : `Your role ends soon: ${role.name_en}`,
    paragraphs: [
      l === "ar"
        ? `ينتهي في ${formatLongDate(role.ends_at, l)}. سلّم ما لديك لمن يخلفك، وراجع المجلس إن كان يجب تمديده.`
        : `It ends on ${formatLongDate(role.ends_at, l)}. Hand over to your successor, and speak to the Council if it should be extended.`,
    ],
  }));

export interface RemovalInfo {
  content_url: string | null;
  details: string;
  due_at: string;
  requester_email: string;
  requester_name: string;
}

const removalHeading = {
  new: { ar: "طلب حذف جديد", en: "New removal request" },
  overdue: { ar: "طلب حذف تجاوز موعده", en: "A removal request is overdue" },
} as const;

export const removalRequested = (
  lang: Lang,
  r: RemovalInfo,
  app: string,
  overdue = false
) =>
  build(lang, (l) => ({
    action: nexus(app, l, "/admin/programs"),
    heading: removalHeading[overdue ? "overdue" : "new"][l],
    paragraphs: [
      l === "ar"
        ? `يجب الحذف قبل ${when(r.due_at, l)} (السياسة 5.3: خلال 24 ساعة، دون الحاجة إلى أسباب).`
        : `Take it down by ${when(r.due_at, l)} (Policy 5.3: within 24 hours, no reasons needed).`,
      `${r.requester_name} <${r.requester_email}>`,
      ...(r.content_url ? [r.content_url] : []),
      r.details,
    ],
  }));

export const removalReceived = (lang: Lang, dueAt: string) =>
  build(lang, (l) => ({
    heading: l === "ar" ? "وصلنا طلب الحذف" : "We have your removal request",
    paragraphs: [
      l === "ar"
        ? `سيُحذف المحتوى خلال 24 ساعة، قبل ${when(dueAt, l)}، وسنكتب إليك عند الانتهاء.`
        : `It comes down within 24 hours, by ${when(dueAt, l)}, and we'll write to you when it's done.`,
    ],
  }));

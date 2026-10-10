import type { NotionPage } from "./client";
import { read, SLUG, slugify, toInstant } from "./props";

/**
 * What a Notion page must hold before the platform publishes it, checked
 * the same way as the Nexus forms and the database. Each problem is a short
 * instruction for the page's Platform note and comment.
 */

export interface EventValues {
  capacity: number | null;
  ends_at: string | null;
  members_only: boolean;
  programme_id: string | null;
  rsvp_enabled: boolean;
  slug: string;
  starts_at: string;
  summary_ar: string | null;
  summary_en: string | null;
  title_ar: string;
  title_en: string;
  venue_ar: string | null;
  venue_en: string | null;
}

export interface NewsValues {
  excerpt_ar: string | null;
  excerpt_en: string | null;
  programme_id: string | null;
  publish_at: string | null;
  slug: string;
  title_ar: string;
  title_en: string;
}

type Checked<T> = { ok: true; values: T } | { ok: false; problems: string[] };

const optional = (text: string) => text || null;

const lengthProblem = (label: string, text: string, max: number) =>
  text.length > max
    ? [`${label} is ${text.length} characters; keep it to ${max}.`]
    : [];

const slugFor = (page: NotionPage, title: string) => {
  const given = read.text(page, "Slug").toLowerCase();
  return given || slugify(title);
};

/** The one program a page is linked to, as a Nexus id. */
const programmeFor = (
  page: NotionPage,
  programmes: ReadonlyMap<string, string>,
  problems: string[]
) => {
  const linked = read
    .relation(page, "Program")
    .map((pageId) => pageId.replaceAll("-", ""));
  if (linked.length > 1) {
    problems.push("Link at most one program.");
  }
  const [first] = linked;
  if (!first) {
    return null;
  }
  const id = programmes.get(first);
  if (!id) {
    problems.push("The linked program is not one of the Nexus programs.");
  }
  return id ?? null;
};

const titles = (page: NotionPage, problems: string[]) => {
  const titleEn = read.text(page, "Title");
  const titleAr = read.text(page, "Title (Arabic)");
  if (!titleEn) {
    problems.push("Add the English title.");
  }
  if (!titleAr) {
    problems.push("Add the Arabic title (Title (Arabic)).");
  }
  problems.push(
    ...lengthProblem("The title", titleEn, 200),
    ...lengthProblem("The Arabic title", titleAr, 200)
  );
  return { titleAr, titleEn };
};

const slugProblems = (slug: string) =>
  SLUG.test(slug)
    ? []
    : [
        "Set a Slug in Latin letters, digits and hyphens (for example open-pages-october); the title gives none.",
      ];

export const checkEvent = (
  page: NotionPage,
  programmes: ReadonlyMap<string, string>
): Checked<EventValues> => {
  const problems: string[] = [];
  const { titleAr, titleEn } = titles(page, problems);
  const when = read.date(page, "When");
  const startsAt = toInstant(when?.start);
  const endsAt = toInstant(when?.end);
  if (!when?.start) {
    problems.push("Set When to the start date and time.");
  } else if (!startsAt) {
    problems.push("Add a start time to When, not only a date.");
  }
  if (when?.end && !endsAt) {
    problems.push("Add an end time to When, or remove the end date.");
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    problems.push("The end of When must be after the start.");
  }
  const summaryEn = read.text(page, "Summary");
  const summaryAr = read.text(page, "Summary (Arabic)");
  problems.push(
    ...lengthProblem("The summary", summaryEn, 500),
    ...lengthProblem("The Arabic summary", summaryAr, 500)
  );
  if (summaryEn && !summaryAr) {
    problems.push("Add the Arabic summary to match the English one.");
  }
  const capacity = read.number(page, "Capacity");
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) {
    problems.push("Capacity must be a whole number above zero, or empty.");
  }
  const slug = slugFor(page, titleEn);
  problems.push(...slugProblems(slug));
  const programmeId = programmeFor(page, programmes, problems);

  if (problems.length > 0 || !startsAt) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    values: {
      capacity,
      ends_at: endsAt,
      members_only: read.checkbox(page, "Members only"),
      programme_id: programmeId,
      rsvp_enabled: read.checkbox(page, "RSVPs open"),
      slug,
      starts_at: startsAt,
      summary_ar: optional(summaryAr),
      summary_en: optional(summaryEn),
      title_ar: titleAr,
      title_en: titleEn,
      venue_ar: optional(read.text(page, "Venue (Arabic)")),
      venue_en: optional(read.text(page, "Venue")),
    },
  };
};

export const checkNews = (
  page: NotionPage,
  programmes: ReadonlyMap<string, string>
): Checked<NewsValues> => {
  const problems: string[] = [];
  const { titleAr, titleEn } = titles(page, problems);
  const excerptEn = read.text(page, "Excerpt");
  const excerptAr = read.text(page, "Excerpt (Arabic)");
  problems.push(
    ...lengthProblem("The excerpt", excerptEn, 400),
    ...lengthProblem("The Arabic excerpt", excerptAr, 400)
  );
  if (excerptEn && !excerptAr) {
    problems.push("Add the Arabic excerpt to match the English one.");
  }
  const on = read.date(page, "Publish on")?.start ?? null;
  // A date alone means 9:00 AM Baghdad time that day.
  const publishAt = on ? (toInstant(on) ?? toInstant(`${on}T09:00:00`)) : null;
  const slug = slugFor(page, titleEn);
  problems.push(...slugProblems(slug));
  const programmeId = programmeFor(page, programmes, problems);

  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    values: {
      excerpt_ar: optional(excerptAr),
      excerpt_en: optional(excerptEn),
      programme_id: programmeId,
      publish_at: publishAt,
      slug,
      title_ar: titleAr,
      title_en: titleEn,
    },
  };
};

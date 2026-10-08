import { project } from "@repo/config";

type Thing = Record<string, unknown>;

/**
 * Structured data for search engines (schema.org JSON-LD). `<` is escaped so
 * text from the database can never close the script tag.
 */
export const JsonLd = ({ data }: { readonly data: Thing }) => (
  <script
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON with < escaped, not HTML
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        "@context": "https://schema.org",
        ...data,
      }).replace(/</g, "\\u003c"),
    }}
    type="application/ld+json"
  />
);

const pageUrl = (locale: string, path: string) =>
  `${project.url}/${locale}${path === "/" ? "" : path}`;

export const organization = (): Thing => ({
  "@id": `${project.url}/#organization`,
  "@type": "Organization",
  alternateName: [project.shortName, project.nameAr],
  email: project.supportEmail,
  logo: `${project.url}/brand/sal-avatar.svg`,
  name: project.name,
  parentOrganization: {
    "@type": "CollegeOrUniversity",
    name: "American University of Iraq – Baghdad",
  },
  url: project.url,
});

export const eventLd = (
  locale: string,
  e: {
    ends_at: string | null;
    image?: string | null;
    name: string;
    slug: string;
    starts_at: string;
    status: string;
    summary?: string | null;
    venue?: string | null;
  }
): Thing => ({
  "@type": "Event",
  description: e.summary ?? undefined,
  endDate: e.ends_at ?? undefined,
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  eventStatus:
    e.status === "cancelled"
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
  image: e.image ?? undefined,
  inLanguage: locale,
  isAccessibleForFree: true,
  location: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IQ",
      addressLocality: "Baghdad",
    },
    name: e.venue ?? "American University of Iraq – Baghdad",
  },
  name: e.name,
  organizer: { "@id": `${project.url}/#organization` },
  startDate: e.starts_at,
  url: pageUrl(locale, `/events/${e.slug}`),
});

export const articleLd = (
  locale: string,
  a: {
    author?: string | null;
    image?: string | null;
    path: string;
    publishedAt?: string | null;
    title: string;
  }
): Thing => ({
  "@type": "Article",
  author: a.author
    ? { "@type": "Person", name: a.author }
    : { "@id": `${project.url}/#organization` },
  datePublished: a.publishedAt ?? undefined,
  headline: a.title,
  image: a.image ?? undefined,
  inLanguage: locale,
  mainEntityOfPage: pageUrl(locale, a.path),
  publisher: { "@id": `${project.url}/#organization` },
});

import { type Client, unwrap } from "./client";
import { sanitizeRichText, toPlainText } from "./sanitize";

/**
 * The Society's documents (governance.society_documents): public ones on
 * auibsal.org/documents, internal ones in the Nexus. Each page shows the
 * status recorded here and nothing else, so a draft is never presented as
 * adopted. Governance managers edit the text and the status in the Nexus.
 */
export const documentStatuses = ["draft", "adopted", "superseded"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const documentAudiences = ["public", "internal"] as const;
export type DocumentAudience = (typeof documentAudiences)[number];

export interface SalDocument {
  adopted_on: string | null;
  audience: string;
  body_ar?: string | null;
  body_en?: string;
  code: string;
  dated: string | null;
  id: string;
  ratification: string | null;
  slug: string;
  sort: number;
  status: string;
  summary_ar: string | null;
  summary_en: string | null;
  title_ar: string | null;
  title_en: string;
  updated_at: string;
  version: string | null;
}

const LISTING =
  "id, slug, code, title_en, title_ar, summary_en, summary_ar, audience, status, version, dated, ratification, adopted_on, sort, updated_at";

/** The public documents, without their text (for listings and the sitemap). */
export const publicDocuments = async (client: Client) =>
  (unwrap(
    await client
      .schema("governance")
      .from("society_documents")
      .select(LISTING)
      .eq("audience", "public")
      .order("sort")
  ) ?? []) as SalDocument[];

/** One document with its text, if the reader may see it. */
export const documentBySlug = async (client: Client, slug: string) =>
  (unwrap(
    await client
      .schema("governance")
      .from("society_documents")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
  ) ?? null) as SalDocument | null;

/** Every document the reader may see (the Nexus). */
export const readableDocuments = async (client: Client) =>
  (unwrap(
    await client
      .schema("governance")
      .from("society_documents")
      .select(LISTING)
      .order("sort")
  ) ?? []) as SalDocument[];

/** The title in the page's language (English when there is no Arabic). */
export const documentTitle = (
  doc: Pick<SalDocument, "title_ar" | "title_en">,
  locale: string
) => (locale === "ar" && doc.title_ar ? doc.title_ar : doc.title_en);

/** The text in the page's language, and whether it fell back to English. */
export const documentBody = (
  doc: Pick<SalDocument, "body_ar" | "body_en">,
  locale: string
) => {
  const arabic = locale === "ar" && doc.body_ar?.trim() ? doc.body_ar : null;
  return { english: !arabic, html: arabic ?? doc.body_en ?? "" };
};

const HEADING = /<h2>([\s\S]*?)<\/h2>/g;
const ENTITIES: Record<string, string> = {
  "&#39;": "'",
  "&#x27;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};
const ENTITY = /&(?:#x27|#39|amp|gt|lt|quot);/g;

// Tags are stripped by the sanitizer (never by a regex); the entities it
// leaves are decoded for the table of contents, which React escapes again.
const plain = (html: string) =>
  toPlainText(html).replace(ENTITY, (e) => ENTITIES[e] ?? e);

const anchor = (text: string, index: number) =>
  `${index + 1}-${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)}`;

/**
 * Sanitized document HTML with an id on every section heading, and the
 * table of contents built from those headings.
 */
export const documentSections = (html: string) => {
  const safe = sanitizeRichText(html);
  const contents: { id: string; title: string }[] = [];
  let index = 0;
  const withIds = safe.replace(HEADING, (_match, inner: string) => {
    const title = plain(inner);
    const id = anchor(title, index);
    index += 1;
    contents.push({ id, title });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { contents, html: withIds };
};

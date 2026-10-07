import { z } from "zod";
import registry from "./documents.json" with { type: "json" };

/**
 * The public document registry: one entry per file in docs-source/. A
 * document page shows the status recorded here and nothing else, so a draft
 * is never presented as adopted. When the General Assembly ratifies a
 * document, change its status (and version) here and replace the PDF.
 */
export const documentStatuses = ["draft", "adopted", "superseded"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

const isoDate = z.iso.date();

export const documentSchema = z.object({
  /** The date of adoption, once recorded (never inferred from the cover). */
  adopted: isoDate.nullable(),
  code: z.string().regex(/^SAL-[A-Z]{3}-\d{2}$/),
  contents: z.array(z.string().min(1)).min(1),
  /** The date on the cover, if any. */
  dated: isoDate.nullable(),
  pages: z.number().int().positive(),
  /** Planned ratification (Charter Day), while a draft. */
  ratification: isoDate.nullable(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** File name in docs-source/. */
  source: z.string().endsWith(".pdf"),
  status: z.enum(documentStatuses),
  /** The cover's subtitle, verbatim (English: the documents are in English). */
  summary: z.string().min(1),
  title: z.object({ ar: z.string().min(1), en: z.string().min(1) }),
  /** The cover's version label, e.g. "Draft 1". */
  version: z.string().nullable(),
});

export type SalDocument = z.infer<typeof documentSchema>;

export const documents: readonly SalDocument[] = z
  .array(documentSchema)
  .parse(registry);

export const documentBySlug = (slug: string) =>
  documents.find((d) => d.slug === slug) ?? null;

/** Where the web build publishes each PDF (apps/web/public/documents). */
export const documentPdfPath = (doc: Pick<SalDocument, "slug">) =>
  `/documents/${doc.slug}.pdf`;

/** The title in the page's language (English for any other locale). */
export const documentTitle = (
  doc: Pick<SalDocument, "title">,
  locale: string
) => (locale === "ar" ? doc.title.ar : doc.title.en);

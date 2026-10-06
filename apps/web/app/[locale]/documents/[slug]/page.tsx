import { DocumentHeader } from "@repo/design-system/components/sal/document-header";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { documents } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentStatus } from "@/components/document-status";
import { localizedMetadata } from "@/lib/metadata";

interface DocumentProps {
  readonly params: Promise<{ locale: Locale; slug: string }>;
}

export const dynamicParams = false;

export const generateStaticParams = () =>
  documents.documents.map((doc) => ({ slug: doc.slug }));

export const generateMetadata = async ({
  params,
}: DocumentProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const doc = documents.documentBySlug(slug);
  if (!doc) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "web.documents" });
  return localizedMetadata(locale, `/documents/${doc.slug}`, {
    description: `${t(`statuses.${doc.status}`)}. ${doc.summary}`,
    title: documents.documentTitle(doc, locale),
  });
};

const DocumentPage = async ({ params }: DocumentProps) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = documents.documentBySlug(slug);
  if (!doc) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.documents" });
  const pdf = documents.documentPdfPath(doc);

  return (
    <article className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-16">
      <Link
        className="type-caption underline underline-offset-4"
        href="/documents"
      >
        {t("all")}
      </Link>
      <DocumentHeader
        code={doc.code}
        nameAr={doc.title.ar}
        title={documents.documentTitle(doc, locale)}
      >
        <p className="type-lede max-w-3xl" dir="ltr" lang="en">
          {doc.summary}
        </p>
        {doc.dated ? (
          <p className="type-caption">
            {t("dated", { date: formatLongDate(doc.dated, locale) })}
          </p>
        ) : null}
      </DocumentHeader>

      <DocumentStatus doc={doc} locale={locale} />

      <div className="flex flex-wrap gap-3">
        <a
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-primary-foreground text-sm"
          href={pdf}
          rel="noopener"
          target="_blank"
        >
          {t("read", { pages: formatNumber(doc.pages, locale) })}
        </a>
        <a
          className="inline-flex h-10 items-center rounded-md border border-rule px-4 text-sm"
          download={`${doc.code} ${doc.title.en}.pdf`}
          href={pdf}
        >
          {t("download")}
        </a>
      </div>

      <section aria-labelledby="contents" className="grid gap-4">
        <h2
          className="type-heading border-accent-line border-b pb-2"
          id="contents"
        >
          {t("contents")}
        </h2>
        {locale === "ar" ? (
          <p className="type-body text-text-secondary">{t("englishOnly")}</p>
        ) : null}
        <ol className="grid gap-2 ps-6" dir="ltr" lang="en">
          {doc.contents.map((item) => (
            <li className="type-body list-decimal" key={item}>
              {item}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
};

export default DocumentPage;

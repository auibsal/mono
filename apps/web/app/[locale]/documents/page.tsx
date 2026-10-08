import type { Locale } from "@repo/internationalization";
import { Link } from "@repo/internationalization/navigation";
import { documents } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedMetadata } from "@/lib/metadata";

interface DocumentsProps {
  readonly params: Promise<{ locale: Locale }>;
}

export const generateMetadata = async ({
  params,
}: DocumentsProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.documents" });
  return localizedMetadata(locale, "/documents", {
    description: t("lede"),
    title: t("title"),
  });
};

const DocumentsPage = async ({ params }: DocumentsProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.documents" });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
        {locale === "ar" ? (
          <p className="type-body text-text-secondary">{t("englishOnly")}</p>
        ) : null}
      </header>
      <ul className="grid gap-6 md:grid-cols-2">
        {documents.documents.map((doc) => (
          <li
            className="frame grid content-start gap-2 bg-surface-tint p-6"
            key={doc.code}
          >
            <p className="type-code text-sm text-text-meta">{doc.code}</p>
            <h2 className="type-heading">
              <Link
                className="underline-offset-4 hover:underline"
                href={`/documents/${doc.slug}`}
              >
                {documents.documentTitle(doc, locale)}
              </Link>
            </h2>
            <p className="type-body" dir="ltr" lang="en">
              {doc.summary}
            </p>
            <p className="type-kicker">{t(`statuses.${doc.status}`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentsPage;

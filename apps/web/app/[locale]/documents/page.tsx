import type { Locale } from "@repo/internationalization";
import { Link } from "@repo/internationalization/navigation";
import { documents } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

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

type Status = documents.DocumentStatus;

const DocumentsPage = async ({ params }: DocumentsProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.documents" });
  const list = await readPublished(
    ["documents"],
    (c) => documents.publicDocuments(c),
    []
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
        {locale === "ar" ? (
          <p className="type-body text-text-secondary">{t("englishOnly")}</p>
        ) : null}
      </header>
      {list.length === 0 ? <p className="type-body">{t("empty")}</p> : null}
      <ul className="grid gap-6 md:grid-cols-2">
        {list.map((doc) => (
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
            {doc.summary_en ? (
              <p className="type-body" dir="auto">
                {(locale === "ar" && doc.summary_ar) || doc.summary_en}
              </p>
            ) : null}
            <p className="type-kicker">
              {t(`statuses.${doc.status as Status}`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentsPage;

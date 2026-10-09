import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { content, documents, localized, toPlainText } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/section";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface SearchProps {
  readonly params: Promise<{ locale: Locale }>;
  readonly searchParams: Promise<{ q?: string }>;
}

export const generateMetadata = async ({
  params,
}: SearchProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.search" });
  return {
    ...localizedMetadata(locale, "/search", {
      description: t("lede"),
      title: t("title"),
    }),
    robots: { follow: true, index: false },
  };
};

type Kind = "event" | "news" | "piece" | "document";

const hrefFor = (kind: Kind, slug: string) => {
  if (kind === "event") {
    return `/events/${slug}`;
  }
  if (kind === "news") {
    return `/news/${slug}`;
  }
  if (kind === "piece") {
    return `/journal/pieces/${slug}`;
  }
  return slug;
};

/** Titles, the cover subtitle and the text of the public documents. */
const searchDocuments = async (query: string) => {
  const needle = query.toLowerCase();
  const list = await readPublished(
    ["documents"],
    async (c) =>
      (
        await Promise.all(
          (
            await documents.publicDocuments(c)
          ).map((doc) => documents.documentBySlug(c, doc.slug))
        )
      ).filter((doc): doc is documents.SalDocument => Boolean(doc)),
    [] as documents.SalDocument[]
  );
  return list
    .filter((doc) =>
      [
        doc.code,
        doc.title_en,
        doc.title_ar ?? "",
        doc.summary_en ?? "",
        toPlainText(doc.body_en),
      ].some((text) => text.toLowerCase().includes(needle))
    )
    .map((doc) => ({
      id: doc.code,
      kind: "document" as const,
      occurred_at: null,
      slug: `/documents/${doc.slug}`,
      snippet: doc.summary_en ?? "",
      title_ar: doc.title_ar ?? doc.title_en,
      title_en: doc.title_en,
    }));
};

const SearchPage = async ({ params, searchParams }: SearchProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.search" });
  const query = ((await searchParams).q ?? "").trim().slice(0, 200);
  const long = query.length >= 2;
  const found = long
    ? await readPublished(
        ["events", "news", "journal"],
        (c) => content.search(c, query),
        []
      )
    : [];
  const results = [
    ...(long ? await searchDocuments(query) : []),
    ...(found ?? []).filter((r) => r.kind !== "document"),
  ];

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")}>
        <search>
          <form action="" className="flex max-w-xl gap-2" method="get">
            <label className="sr-only" htmlFor="q">
              {t("label")}
            </label>
            <Input
              defaultValue={query}
              id="q"
              maxLength={200}
              name="q"
              placeholder={t("placeholder")}
              type="search"
            />
            <Button type="submit">{t("submit")}</Button>
          </form>
        </search>
      </PageHeader>
      {query && !long ? <p className="type-body">{t("short")}</p> : null}
      {long ? (
        <section aria-live="polite" className="grid gap-4">
          <h2 className="type-heading">
            {results.length ? t("results", { query }) : t("none", { query })}
          </h2>
          <ul className="grid gap-4">
            {results.map((r) => (
              <li
                className="grid gap-1 border-rule border-b pb-4"
                key={`${r.kind}-${r.id}`}
              >
                <p className="type-kicker">
                  {t(`kinds.${r.kind as Kind}`)}
                  {r.occurred_at
                    ? ` · ${formatLongDate(r.occurred_at, locale)}`
                    : ""}
                </p>
                <Link
                  className="type-subheading underline-offset-4 hover:underline"
                  href={hrefFor(r.kind as Kind, r.slug)}
                >
                  {localized(r, "title", locale)}
                </Link>
                {r.snippet ? (
                  <p className="type-body text-text-secondary">{r.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default SearchPage;

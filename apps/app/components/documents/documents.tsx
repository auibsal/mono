"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { documents } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";

type Status = documents.DocumentStatus;
type Audience = documents.DocumentAudience;

/**
 * The Society's documents in the Nexus: the public ones (also on
 * auibsal.org) and, for officers who read the internal library, the
 * internal ones (Row Level Security decides).
 */
export const Documents = () => {
  const t = useTranslations("nexus.documents");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const list = useQuery({
    queryFn: () => documents.readableDocuments(supabase),
    queryKey: ["documents"],
  });

  if (list.isPending) {
    return <SectionSpinner />;
  }
  if (list.isError) {
    return <ErrorState onRetry={() => list.refetch()} />;
  }
  const groups = documents.documentAudiences
    .map((audience) => ({
      audience,
      docs: list.data.filter((d) => d.audience === audience),
    }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>
      {groups.length === 0 ? (
        <EmptyLine action={{ href: "/", label: t("home") }}>
          {t("empty")}
        </EmptyLine>
      ) : null}
      {groups.map((g) => (
        <section className="grid gap-3" key={g.audience}>
          <h2 className="type-subheading">
            {t(`groups.${g.audience as Audience}`)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.docs.map((d) => (
              <li key={d.id}>
                <SalCard>
                  <div className="grid gap-1">
                    <p className="type-kicker">{d.code}</p>
                    <Link
                      className="font-bold underline underline-offset-4"
                      href={{
                        pathname: "/documents/view",
                        query: { slug: d.slug },
                      }}
                    >
                      {documents.documentTitle(d, locale)}
                    </Link>
                    <p className="type-caption">
                      {t(`statuses.${d.status as Status}`)} ·{" "}
                      {t("updated", {
                        date: formatLongDate(d.updated_at, locale, true),
                      })}
                    </p>
                  </div>
                </SalCard>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export const DocumentView = () => {
  const t = useTranslations("nexus.documents");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const slug = useSearchParams().get("slug") ?? "";
  const doc = useQuery({
    enabled: Boolean(slug),
    queryFn: () => documents.documentBySlug(supabase, slug),
    queryKey: ["documents", slug],
  });

  if (doc.isPending && slug) {
    return <SectionSpinner />;
  }
  if (!doc.data) {
    return (
      <EmptyLine action={{ href: "/documents", label: t("back") }}>
        {t("notFound")}
      </EmptyLine>
    );
  }
  const body = documents.documentBody(doc.data, locale);
  const { contents, html } = documents.documentSections(body.html);

  return (
    <article className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link className="type-body underline" href="/documents">
          {t("back")}
        </Link>
        <Button onClick={() => window.print()} size="sm" variant="outline">
          {t("print")}
        </Button>
      </div>
      <header className="grid gap-2">
        <p className="type-kicker">
          {doc.data.code} · {t(`groups.${doc.data.audience as Audience}`)}
        </p>
        <h1 className="type-display">
          {documents.documentTitle(doc.data, locale)}
        </h1>
        {doc.data.summary_en ? (
          <p className="type-lede max-w-2xl" dir="auto">
            {(locale === "ar" && doc.data.summary_ar) || doc.data.summary_en}
          </p>
        ) : null}
        <p className="type-caption">
          {t(`statuses.${doc.data.status as Status}`)}
          {doc.data.version ? ` · ${doc.data.version}` : ""}
          {doc.data.adopted_on
            ? ` · ${t("adoptedOn", { date: formatLongDate(doc.data.adopted_on, locale) })}`
            : ""}
        </p>
      </header>
      {contents.length > 0 ? (
        <nav aria-label={t("contents")} className="print:hidden">
          <ol className="grid gap-1 ps-6" dir={body.english ? "ltr" : "rtl"}>
            {contents.map((c) => (
              <li className="type-body list-decimal" key={c.id}>
                <a
                  className="underline-offset-4 hover:underline"
                  href={`#${c.id}`}
                >
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {body.english && locale === "ar" ? (
        <p className="type-body text-text-secondary">{t("englishOnly")}</p>
      ) : null}
      {html ? (
        <div
          className="document-text prose max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by documentSections
          dangerouslySetInnerHTML={{ __html: html }}
          dir={body.english ? "ltr" : "rtl"}
          lang={body.english ? "en" : "ar"}
        />
      ) : (
        <p className="type-body">{t("noText")}</p>
      )}
    </article>
  );
};

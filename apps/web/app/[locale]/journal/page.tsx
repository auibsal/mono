import { project } from "@repo/config";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PieceList } from "@/components/piece-list";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface JournalProps {
  readonly params: Promise<{ locale: Locale }>;
}

export const generateMetadata = async ({
  params,
}: JournalProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.journal" });
  return localizedMetadata(locale, "/journal", {
    description: t("lede"),
    title: t("title"),
  });
};

const JournalHomePage = async ({ params }: JournalProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.journal" });
  const [issues, pieces, calls] = await Promise.all([
    readPublished(["journal"], (c) => journal.publishedIssues(c), []),
    readPublished(["journal"], (c) => journal.latestPieces(c, 8), []),
    readPublished(["journal"], (c) => journal.openCalls(c), []),
  ]);
  const heading = "type-heading border-accent-line border-b pb-2";

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
      </header>

      <section aria-labelledby="calls" className="grid gap-4">
        <h2 className={heading} id="calls">
          {t("calls")}
        </h2>
        {(calls ?? []).length === 0 ? (
          <p className="type-body text-text-secondary">{t("noCalls")}</p>
        ) : null}
        {(calls ?? []).map((call) => (
          <div
            className="grid gap-2 rounded-card bg-surface-tint p-6"
            key={call.id}
          >
            <h3 className="type-subheading">
              {localized(call, "title", locale)}
            </h3>
            {localized(call, "theme", locale) ? (
              <p className="type-body">{localized(call, "theme", locale)}</p>
            ) : null}
            <p className="type-caption">
              {t("closes", { date: formatLongDate(call.closes_at, locale) })}
            </p>
            <a
              className="inline-flex h-10 items-center justify-self-start rounded-md bg-primary px-4 text-primary-foreground text-sm"
              href={`${project.hosts.app}/${locale}/journal/submit?call=${call.id}`}
            >
              {t("submit")}
            </a>
          </div>
        ))}
      </section>

      {(issues ?? []).length > 0 ? (
        <section aria-labelledby="issues" className="grid gap-4">
          <h2 className={heading} id="issues">
            {t("issues")}
          </h2>
          <ul className="grid gap-3">
            {(issues ?? []).map((issue) => (
              <li key={issue.id}>
                <Link
                  className="type-subheading underline-offset-4 hover:underline"
                  href={`/journal/${issue.slug}`}
                >
                  {t("volumeNumber", {
                    number: formatNumber(issue.number, locale),
                    volume: formatNumber(issue.volume, locale),
                  })}{" "}
                  · {localized(issue, "title", locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="latest" className="grid gap-4">
        <h2 className={heading} id="latest">
          {t("latest")}
        </h2>
        {(pieces ?? []).length === 0 ? (
          <p className="type-body text-text-secondary">{t("noPieces")}</p>
        ) : (
          <PieceList locale={locale} pieces={pieces ?? []} />
        )}
      </section>
    </div>
  );
};

export default JournalHomePage;

import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { localized, productions } from "@repo/sal-data";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { mediaUrl } from "@/lib/media";
import { type LocaleParams, sectionMetadata } from "@/lib/page";
import { readPublished } from "@/lib/supabase";

export const generateMetadata = sectionMetadata(
  "web.productions",
  "/productions"
);

type Kind = productions.ProductionKind;
type Department = productions.Department;

const DEPARTMENTS = productions.departments;

const loadAll = async () =>
  readPublished(
    ["productions", "partners", "events"],
    async (c) => {
      const list = await productions.publicProductions(c);
      return Promise.all(
        list.map(async (p) => ({
          ...p,
          ...(await productions.publicProduction(c, p.id)),
        }))
      );
    },
    []
  );

/**
 * Staged readings and productions. Only what may be public is read: the
 * title, summary and poster, the credits people agreed to show, partners
 * with a memorandum in force, and published performances once the
 * script's rights are cleared.
 */
const ProductionsPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.productions" });
  const list = await loadAll();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      {list.length === 0 ? <p className="type-body">{t("empty")}</p> : null}
      {list.map((p) => {
        const poster = mediaUrl(p.poster_path);
        const summary = localized(p, "summary", locale);
        return (
          <Section
            id={p.slug}
            key={p.slug}
            title={localized(p, "title", locale)}
          >
            <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
              {poster ? (
                // biome-ignore lint/performance/noImgElement: a poster from the media bucket
                <img
                  alt={t("posterAlt", { title: localized(p, "title", locale) })}
                  className="w-full rounded-card object-cover"
                  height={600}
                  src={poster}
                  width={420}
                />
              ) : null}
              <div className="grid content-start gap-4">
                <p className="type-kicker">
                  {t(`kinds.${p.kind as Kind}`)}
                  {p.playwright ? ` · ${t("by", { name: p.playwright })}` : ""}
                </p>
                {summary ? <p className="type-body">{summary}</p> : null}
                {p.partners.length > 0 ? (
                  <p className="type-body">
                    {t("with", {
                      names: p.partners
                        .map((partner) => localized(partner, "name", locale))
                        .join(locale === "ar" ? "، " : ", "),
                    })}
                  </p>
                ) : null}
                {p.performances.length > 0 ? (
                  <div className="grid gap-2">
                    <h3 className="type-subheading">{t("performances")}</h3>
                    <ul className="grid gap-2">
                      {p.performances.map((e) => (
                        <li key={e.slug}>
                          <Link
                            className="underline underline-offset-4"
                            href={`/events/${e.slug}`}
                          >
                            {formatLongDate(e.starts_at, locale)} ·{" "}
                            {formatClock(e.starts_at, locale)}
                            {localized(e, "venue", locale)
                              ? ` · ${localized(e, "venue", locale)}`
                              : ""}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {p.credits.length > 0 ? (
                  <div className="grid gap-3">
                    <h3 className="type-subheading">{t("company")}</h3>
                    {DEPARTMENTS.map((d) => {
                      const people = p.credits.filter(
                        (c) => c.department === d
                      );
                      if (people.length === 0) {
                        return null;
                      }
                      return (
                        <div className="grid gap-1" key={d}>
                          <p className="type-kicker">
                            {t(`departments.${d as Department}`)}
                          </p>
                          <ul className="grid gap-1">
                            {people.map((c) => (
                              <li
                                className="type-body"
                                key={`${c.role_en}-${c.name_en}`}
                              >
                                <span className="font-bold">
                                  {localized(c, "name", locale)}
                                </span>
                                {" · "}
                                {localized(c, "role", locale)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </Section>
        );
      })}
    </div>
  );
};

export default ProductionsPage;

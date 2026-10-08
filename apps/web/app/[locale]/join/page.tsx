import { project } from "@repo/config";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.join", "/join");

const STEPS = ["register", "commonRoom", "twoThings"] as const;
const TIERS = ["member", "voting", "fellow", "honorary", "alumni"] as const;

const JoinPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.join" });
  const heading = "type-heading border-accent-line border-b pb-2";
  const cta = (
    <div className="grid gap-2">
      <a
        className="inline-flex h-11 items-center justify-self-start rounded-md bg-primary px-5 text-primary-foreground"
        href={`${project.hosts.app}/${locale}/sign-in`}
      >
        {t("cta")}
      </a>
      <p className="type-caption">{t("ctaHint")}</p>
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
        {cta}
      </header>

      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((key, index) => (
          <li
            className="frame grid content-start gap-2 bg-surface-tint p-5"
            key={key}
          >
            <p className="type-kicker">{index + 1}</p>
            <h2 className="type-subheading">{t(`steps.${key}.title`)}</h2>
            <p className="type-body">{t(`steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="tiers" className="grid gap-4">
        <h2 className={heading} id="tiers">
          {t("tiersTitle")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="border-rule border-b">
                <th className="py-2 pe-4 text-start" scope="col">
                  {t("tiersYou")}
                </th>
                <th className="py-2 pe-4 text-start" scope="col">
                  {t("tiersIf")}
                </th>
                <th className="py-2 text-start" scope="col">
                  {t("tiersCan")}
                </th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((key) => (
                <tr className="border-rule border-b align-top" key={key}>
                  <th className="py-3 pe-4 text-start font-medium" scope="row">
                    {t(`tiers.${key}.name`)}
                  </th>
                  <td className="py-3 pe-4">{t(`tiers.${key}.if`)}</td>
                  <td className="py-3">{t(`tiers.${key}.can`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="first-month" className="grid gap-3">
        <h2 className={heading} id="first-month">
          {t("firstMonthTitle")}
        </h2>
        <p className="type-body">{t("firstMonth")}</p>
      </section>
      {cta}
    </div>
  );
};

export default JoinPage;

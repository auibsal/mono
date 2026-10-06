import { Link } from "@repo/internationalization/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.about", "/about");

const PILLARS = ["connecting", "fostering", "celebrating", "building"] as const;
const GLANCE = [
  "open",
  "power",
  "council",
  "elections",
  "editors",
  "money",
  "process",
  "last",
] as const;

const AboutPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.about" });
  const heading = "type-heading border-accent-line border-b pb-2";

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
        <p className="type-caption">
          {t("draftNote")}{" "}
          <Link
            className="underline underline-offset-4"
            href="/documents/constitution"
          >
            SAL-GOV-01
          </Link>
        </p>
      </header>

      <section aria-labelledby="preamble" className="grid gap-3">
        <h2 className={heading} id="preamble">
          {t("preambleTitle")}
        </h2>
        <p className="type-body">{t("preamble")}</p>
      </section>

      <section aria-labelledby="motto" className="grid gap-3">
        <h2 className={heading} id="motto">
          {t("mottoTitle")}
        </h2>
        <p className="type-heading" dir="rtl" lang="ar">
          والقرطاسُ والقلم
        </p>
        {locale === "ar" ? null : (
          <p className="type-subheading">{t("motto")}</p>
        )}
        <p className="type-body text-text-secondary">{t("mottoNote")}</p>
      </section>

      <section aria-labelledby="pillars" className="grid gap-4">
        <h2 className={heading} id="pillars">
          {t("pillarsTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((key) => (
            <li
              className="grid gap-1 rounded-card bg-surface-tint p-5"
              key={key}
            >
              <h3 className="type-subheading">{t(`pillars.${key}.title`)}</h3>
              <p className="type-body">{t(`pillars.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="glance" className="grid gap-4">
        <h2 className={heading} id="glance">
          {t("glanceTitle")}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {GLANCE.map((key) => (
            <div className="grid gap-1" key={key}>
              <dt className="type-subheading">{t(`glance.${key}.title`)}</dt>
              <dd className="type-body">{t(`glance.${key}.body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="type-body">{t("nonPartisan")}</p>
      <Link
        className="inline-flex h-10 items-center justify-self-start rounded-md border border-rule px-4 text-sm"
        href="/documents"
      >
        {t("documents")}
      </Link>
    </div>
  );
};

export default AboutPage;

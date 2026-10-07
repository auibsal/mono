import { getTranslations, setRequestLocale } from "next-intl/server";
import { RemovalForm } from "@/components/removal-form";
import { PageHeader, Section } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.care", "/side-quest/care");

const PROMISE = ["5_1", "5_2", "5_3", "5_4", "5_5"] as const;

const CarePage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.care" });
  const tp = await getTranslations({ locale, namespace: "web.privacy" });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      <Section id="promise" title={t("promiseTitle")}>
        <ol className="grid gap-3">
          {PROMISE.map((id) => (
            <li className="grid grid-cols-[3rem_1fr] gap-2" key={id}>
              <span className="type-code text-text-meta" dir="ltr">
                {id.replace("_", ".")}
              </span>
              <span className="type-body">{tp(`p.${id}`)}</span>
            </li>
          ))}
        </ol>
        <p className="type-caption">{t("source")}</p>
      </Section>
      <section
        aria-labelledby="request-title"
        className="grid gap-4"
        id="request"
      >
        <h2
          className="type-heading border-accent-line border-b pb-2"
          id="request-title"
        >
          {t("formTitle")}
        </h2>
        <p className="type-body">{t("formLede")}</p>
        <RemovalForm />
      </section>
    </div>
  );
};

export default CarePage;

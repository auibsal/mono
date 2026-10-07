import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { env } from "@/env";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.privacy", "/privacy");

const PHOTO = ["5_1", "5_2", "5_3", "5_4", "5_5"] as const;
const DATA = ["6_1", "6_2", "6_3", "6_4", "6_5"] as const;
const PLATFORM = ["signIn", "storage", "email", "hosting"] as const;

const Clauses = ({
  items,
  label,
}: {
  items: readonly { id: string; text: string }[];
  label: (id: string) => string;
}) => (
  <ol className="grid gap-3">
    {items.map(({ id, text }) => (
      <li className="grid grid-cols-[3rem_1fr] gap-2" key={id}>
        <span className="type-code text-text-meta" dir="ltr">
          {label(id)}
        </span>
        <span className="type-body">{text}</span>
      </li>
    ))}
  </ol>
);

const PrivacyPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.privacy" });
  const clause = (id: string) => id.replace("_", ".");

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      <Section id="photo" title={t("photoTitle")}>
        <Clauses
          items={PHOTO.map((id) => ({ id, text: t(`p.${id}`) }))}
          label={clause}
        />
        <p className="type-caption">{t("source")}</p>
      </Section>
      <Section id="data" title={t("dataTitle")}>
        <Clauses
          items={DATA.map((id) => ({ id, text: t(`p.${id}`) }))}
          label={clause}
        />
        <p className="type-caption">{t("source")}</p>
      </Section>
      <Section id="platform" title={t("platformTitle")}>
        <ul className="grid list-disc gap-2 ps-6">
          {PLATFORM.map((key) => (
            <li className="type-body" key={key}>
              {t(`platform.${key}`)}
            </li>
          ))}
          <li className="type-body">
            {env.NEXT_PUBLIC_GA_ID
              ? t("platform.analyticsOn")
              : t("platform.analytics")}
          </li>
          <li className="type-body">{t("platform.delete")}</li>
        </ul>
      </Section>
    </div>
  );
};

export default PrivacyPage;

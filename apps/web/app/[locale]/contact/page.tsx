import { Link } from "@repo/internationalization/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.contact", "/contact");

const INSTAGRAM = "https://www.instagram.com/auibsal";

const ContactPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.contact" });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="frame grid gap-1 bg-surface-tint p-5">
          <dt className="type-caption">{t("instagram")}</dt>
          <dd>
            <a
              className="type-subheading underline-offset-4 hover:underline"
              dir="ltr"
              href={INSTAGRAM}
              rel="noopener noreferrer"
              target="_blank"
            >
              @auibsal
            </a>
          </dd>
        </div>
        <div className="frame grid gap-1 bg-surface-tint p-5">
          <dt className="type-caption">{t("telegram")}</dt>
          <dd className="type-subheading" dir="ltr" lang="en">
            {t("telegramName")}
          </dd>
        </div>
        <div className="frame grid gap-1 bg-surface-tint p-5">
          <dt className="type-caption">{t("email")}</dt>
          <dd className="type-body">{t("emailPending")}</dd>
        </div>
      </dl>
      <Section id="concern" title={t("concernTitle")}>
        <blockquote className="grid gap-1 border-accent-line border-s-4 ps-4">
          <p className="type-body">{t("concern")}</p>
          <footer className="type-caption">{t("concernSource")}</footer>
        </blockquote>
      </Section>
      <Section id="photo" title={t("photoTitle")}>
        <p className="type-body">{t("photo")}</p>
        <Link
          className="inline-flex h-10 items-center justify-self-start rounded-md border border-rule px-4 text-sm"
          href="/side-quest/care#request"
        >
          {t("photoLink")}
        </Link>
      </Section>
    </div>
  );
};

export default ContactPage;

import { Link } from "@repo/internationalization/navigation";
import { content } from "@repo/sal-data";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";
import { readPublished } from "@/lib/supabase";

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const generateMetadata = sectionMetadata("web.contact", "/contact");

const INSTAGRAM = "https://www.instagram.com/auibsal";

const ContactPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.contact" });
  // Edited by officers in Nexus → Settings.
  const [email, telegram] = await Promise.all([
    readPublished(
      ["about"],
      (c) => content.publicSetting(c, "contact.email"),
      null
    ),
    readPublished(
      ["about"],
      (c) => content.publicSetting(c, "contact.telegram_url"),
      null
    ),
  ]);

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
            {text(telegram) ? (
              <a
                className="underline-offset-4 hover:underline"
                href={text(telegram)}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("telegramName")}
              </a>
            ) : (
              t("telegramName")
            )}
          </dd>
        </div>
        <div className="frame grid gap-1 bg-surface-tint p-5">
          <dt className="type-caption">{t("email")}</dt>
          <dd>
            {text(email) ? (
              <a
                className="type-subheading break-all underline-offset-4 hover:underline"
                dir="ltr"
                href={`mailto:${text(email)}`}
              >
                {text(email)}
              </a>
            ) : (
              <span className="type-body">{t("emailPending")}</span>
            )}
          </dd>
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
          className="type-label frame press inline-flex h-10 items-center justify-self-start bg-surface px-4 text-xs shadow-offset"
          href="/side-quest/care#request"
        >
          {t("photoLink")}
        </Link>
      </Section>
    </div>
  );
};

export default ContactPage;

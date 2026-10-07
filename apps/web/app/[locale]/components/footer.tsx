import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Link } from "@repo/internationalization/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

const Column = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <nav aria-label={title} className="grid content-start gap-3">
    <p className="type-kicker">{title}</p>
    <ul className="grid gap-2 text-sm">{children}</ul>
  </nav>
);

const linkClass = "underline-offset-4 hover:underline";

/** Footer: the bilingual lockup (the public face), then two link columns. */
export const Footer = async () => {
  const t = await getTranslations("web.footer");
  const tc = await getTranslations("common");
  const tn = await getTranslations("web.nav");
  const locale = await getLocale();

  const explore = [
    ["/about", tn("about")],
    ["/programmes", tn("programmes")],
    ["/waraq", tn("waraq")],
    ["/events", tn("events")],
    ["/give", tn("give")],
    ["/news", tn("news")],
    ["/join", tn("join")],
    ["/documents", tn("documents")],
  ] as const;
  const info = [
    ["/contact", t("contact")],
    ["/media-kit", t("mediaKit")],
    ["/privacy", t("privacy")],
    ["/side-quest/care", t("sideQuestCare")],
    ["/search", t("search")],
  ] as const;

  return (
    <footer className="border-rule border-t bg-surface-tint">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <BrandLogo height={72} locale={locale} variant="bilingual" />
          <p className="text-sm text-text-secondary">{t("university")}</p>
          <p className="font-bold text-title">
            {tc("motto")}
            {locale === "ar" ? null : (
              <span className="ms-3" lang="ar">
                {project.motto.ar}
              </span>
            )}
          </p>
        </div>
        <Column title={t("explore")}>
          {explore.map(([href, label]) => (
            <li key={href}>
              <Link className={linkClass} href={href}>
                {label}
              </Link>
            </li>
          ))}
        </Column>
        <Column title={t("info")}>
          {info.map(([href, label]) => (
            <li key={href}>
              <Link className={linkClass} href={href}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a className={linkClass} href={`${project.hosts.app}/${locale}`}>
              {tn("nexus")}
            </a>
          </li>
        </Column>
      </div>
    </footer>
  );
};

import { project } from "@repo/config";
import { Link } from "@repo/internationalization/navigation";
import { getLocale, getTranslations } from "next-intl/server";

/** v5 footer: the ink ground, the rest of the sections and the small print. */
export const Footer = async () => {
  const t = await getTranslations("web.footer");
  const tc = await getTranslations("common");
  const tn = await getTranslations("web.nav");
  const locale = await getLocale();

  const groups = [
    [
      ["/give", tn("give")],
      ["/news", tn("news")],
      ["/documents", tn("documents")],
      ["/partners", t("partners")],
      ["/productions", t("productions")],
      ["/search", t("search")],
    ],
    [
      ["/contact", t("contact")],
      ["/media-kit", t("mediaKit")],
      ["/privacy", t("privacy")],
      ["/side-quest/care", t("sideQuestCare")],
    ],
  ] as const;

  return (
    <footer className="frame-t bg-surface text-text" data-theme="dark">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid content-start gap-2 lg:col-span-2">
          <p className="font-bold text-lg">{tc("society")}</p>
          <p className="type-caption">{t("university")}</p>
          <p className="type-caption" lang="ar">
            {project.motto.ar}
          </p>
          <a
            className="type-label mt-4 justify-self-start border-2 border-frame px-4 py-2 text-xs shadow-offset"
            href={`${project.hosts.app}/${locale}`}
          >
            {tn("nexus")}
          </a>
        </div>
        {groups.map((links) => (
          <ul className="grid content-start gap-2 text-sm" key={links[0][0]}>
            {links.map(([href, label]) => (
              <li key={href}>
                <Link
                  className="underline-offset-4 hover:underline"
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </footer>
  );
};

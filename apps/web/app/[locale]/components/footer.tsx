import { project } from "@repo/config";
import { Link } from "@repo/internationalization/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export const Footer = async () => {
  const t = await getTranslations("web.footer");
  const tc = await getTranslations("common");
  const tn = await getTranslations("web.nav");
  const locale = await getLocale();

  return (
    <footer className="border-rule border-t bg-surface-tint">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:grid-cols-2">
        <div className="grid content-start gap-1">
          <p className="font-bold">{tc("society")}</p>
          <p className="type-caption">{t("university")}</p>
          <p className="type-caption" lang="ar">
            {project.motto.ar}
          </p>
        </div>
        <ul className="grid content-start gap-1 text-sm sm:justify-items-end">
          {(
            [
              ["/contact", t("contact")],
              ["/media-kit", t("mediaKit")],
              ["/privacy", t("privacy")],
              ["/side-quest/care", t("sideQuestCare")],
              ["/search", t("search")],
            ] as const
          ).map(([href, label]) => (
            <li key={href}>
              <Link className="underline-offset-4 hover:underline" href={href}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a
              className="underline-offset-4 hover:underline"
              href={`${project.hosts.app}/${locale}`}
            >
              {tn("nexus")}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
};

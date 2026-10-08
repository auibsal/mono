"use client";

import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import { type Locale, locales } from "@repo/internationalization/config";
import { Link, usePathname } from "@repo/internationalization/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// Five sections in the header (v5); Give, News and Documents are in the footer.
type SectionKey = "about" | "programs" | "journal" | "events" | "join";
const sections: { href: string; key: SectionKey }[] = [
  { href: "/about", key: "about" },
  { href: "/programs", key: "programs" },
  { href: "/journal", key: "journal" },
  { href: "/events", key: "events" },
  { href: "/join", key: "join" },
];

/**
 * v5 header: white, sticky, ruled in ink. Sections in tracked capitals (plain
 * in Arabic); on phones they open in an ink panel under the bar.
 */
export const Header = () => {
  const t = useTranslations("web.nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other = (locales.find((l) => l !== locale) ?? locale) as Locale;
  const nexus = `${project.hosts.app}/${locale}`;

  const links = (large: boolean) => (
    <ul className={large ? "grid gap-1" : "flex items-center gap-6"}>
      {sections.map((section) => {
        const current = pathname.startsWith(section.href);
        return (
          <li key={section.href}>
            <Link
              aria-current={current ? "page" : undefined}
              className={
                large
                  ? "block border-rule border-b py-4 font-bold text-2xl text-title"
                  : `type-label block border-b-2 py-1 text-xs hover:border-frame ${current ? "border-title" : "border-transparent"}`
              }
              href={section.href}
              onClick={() => setOpen(false)}
            >
              {t(section.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <header className="frame-b sticky top-0 z-40 bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
        <Link className="shrink-0" href="/">
          <BrandLogo height={56} locale={locale} />
        </Link>
        <nav aria-label={tc("society")} className="ms-auto hidden lg:block">
          {links(false)}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-6">
          <Link
            className="whitespace-nowrap px-2 py-1 text-sm underline-offset-4 hover:underline"
            href={pathname}
            lang={other}
            locale={other}
          >
            {tc("otherLanguage")}
          </Link>
          <Button asChild className="hidden sm:inline-flex" size="sm">
            <a href={`${nexus}/sign-in`}>{t("signIn")}</a>
          </Button>
          <Button
            aria-expanded={open}
            aria-label={open ? tc("closeMenu") : tc("openMenu")}
            className="lg:hidden"
            onClick={() => setOpen(!open)}
            size="icon"
            variant="outline"
          >
            {open ? (
              <XIcon aria-hidden="true" />
            ) : (
              <MenuIcon aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      {open ? (
        <div
          className="frame-t max-h-[calc(100dvh-5rem)] overflow-y-auto bg-surface px-4 pt-2 pb-8 lg:hidden"
          data-theme="dark"
        >
          <nav aria-label={tc("society")}>{links(true)}</nav>
          <Button asChild className="mt-6 w-full" size="lg">
            <a href={`${nexus}/sign-in`}>{t("signIn")}</a>
          </Button>
        </div>
      ) : null}
    </header>
  );
};

"use client";

import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import { type Locale, locales } from "@repo/internationalization/config";
import { Link, usePathname } from "@repo/internationalization/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// Sections are added here as their pages land (see PROGRESS.md).
type SectionKey =
  | "about"
  | "programmes"
  | "waraq"
  | "events"
  | "give"
  | "join"
  | "news"
  | "documents";
const sections: { href: string; key: SectionKey }[] = [
  { href: "/waraq", key: "waraq" },
  { href: "/events", key: "events" },
  { href: "/documents", key: "documents" },
];

/** Words-first header: horizontal lockup, sections, language, sign in. */
export const Header = () => {
  const t = useTranslations("web.nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other = (locales.find((l) => l !== locale) ?? locale) as Locale;
  const nexus = `${project.hosts.app}/${locale}`;

  const links = (
    <ul className="flex flex-col gap-1 lg:flex-row lg:gap-5">
      {sections.map((section) => (
        <li key={section.href}>
          <Link
            aria-current={
              pathname.startsWith(section.href) ? "page" : undefined
            }
            className="block py-2 text-sm underline-offset-4 hover:underline lg:py-0"
            href={section.href}
          >
            {t(section.key)}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="border-rule border-b bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-4 sm:gap-4">
        <Link className="shrink-0" href="/">
          <BrandLogo height={64} locale={locale} />
        </Link>
        <nav aria-label={tc("society")} className="ms-auto hidden lg:block">
          {links}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ms-0">
          <Link
            className="whitespace-nowrap px-2 py-1 text-sm underline-offset-4 hover:underline"
            href={pathname}
            lang={other}
            locale={other}
          >
            {tc("otherLanguage")}
          </Link>
          <Button asChild size="sm" variant="outline">
            <a href={`${nexus}/sign-in`}>{t("signIn")}</a>
          </Button>
          {sections.length > 0 ? (
            <Button
              aria-expanded={open}
              aria-label={open ? tc("closeMenu") : tc("openMenu")}
              className="lg:hidden"
              onClick={() => setOpen(!open)}
              size="icon"
              variant="ghost"
            >
              {open ? (
                <XIcon aria-hidden="true" />
              ) : (
                <MenuIcon aria-hidden="true" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <nav
          aria-label={tc("society")}
          className="border-rule border-t px-4 py-2 lg:hidden"
        >
          {links}
        </nav>
      ) : null}
    </header>
  );
};

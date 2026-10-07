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
// The bar holds the five main sections; the menu (small screens) and the
// footer carry the rest.
const primary: { href: string; key: SectionKey }[] = [
  { href: "/about", key: "about" },
  { href: "/programmes", key: "programmes" },
  { href: "/waraq", key: "waraq" },
  { href: "/events", key: "events" },
  { href: "/give", key: "give" },
];
const secondary: { href: string; key: SectionKey }[] = [
  { href: "/news", key: "news" },
  { href: "/join", key: "join" },
  { href: "/documents", key: "documents" },
];

/** Words-first header: horizontal lockup, main sections, language, sign in. */
export const Header = () => {
  const t = useTranslations("web.nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other = (locales.find((l) => l !== locale) ?? locale) as Locale;
  const nexus = `${project.hosts.app}/${locale}`;

  const links = (items: typeof primary) => (
    <ul className="flex flex-col lg:flex-row lg:gap-6">
      {items.map((section) => (
        <li key={section.href}>
          <Link
            aria-current={
              pathname.startsWith(section.href) ? "page" : undefined
            }
            className="block py-3 font-medium text-sm underline-offset-[6px] hover:underline aria-[current=page]:text-title aria-[current=page]:underline lg:py-0"
            href={section.href}
            onClick={() => setOpen(false)}
          >
            {t(section.key)}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="sticky top-0 z-40 border-rule border-b bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-4 sm:gap-4">
        <Link className="shrink-0" href="/">
          <BrandLogo height={52} locale={locale} />
        </Link>
        <nav aria-label={tc("society")} className="ms-auto hidden lg:block">
          {links(primary)}
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
          <Button asChild size="sm">
            <a href={`${nexus}/sign-in`}>{t("signIn")}</a>
          </Button>
          {primary.length > 0 ? (
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
          className="grid gap-2 border-rule border-t px-4 py-2 lg:hidden"
        >
          {links(primary)}
          <div className="border-rule border-t">{links(secondary)}</div>
        </nav>
      ) : null}
    </header>
  );
};

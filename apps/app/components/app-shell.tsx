"use client";

import { useAuth } from "@repo/auth/provider";
import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { cn } from "@repo/design-system/lib/utils";
import {
  Link,
  usePathname,
  useRouter,
} from "@repo/internationalization/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MenuIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { useVisibleModules } from "./admin/admin-shell";
import { LanguageSwitcher } from "./language-switcher";

// Sections are added here as their pages land (see PROGRESS.md).
const memberLinks = [
  { href: "/", key: "home" },
  { href: "/events", key: "events" },
  { href: "/programmes", key: "programmes" },
  { href: "/waraq", key: "waraq" },
  { href: "/profile", key: "profile" },
] as const;

const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
  const t = useTranslations("nexus.nav");
  const pathname = usePathname();
  const { visible } = useVisibleModules();
  const links = [
    ...memberLinks,
    ...(visible.length > 0 ? [{ href: "/admin", key: "admin" } as const] : []),
  ];

  return (
    <ul className="flex flex-col lg:flex-row lg:items-center lg:gap-6">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <li key={link.href}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "lg:type-label block border-rule border-b py-4 font-bold text-xl lg:border-transparent lg:border-b-2 lg:py-1 lg:text-xs lg:hover:border-frame",
                active && "text-title lg:border-accent-line"
              )}
              href={link.href}
              onClick={onNavigate}
            >
              {t(link.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

/** The Nexus frame: skip link, header with words-first navigation, main. */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const t = useTranslations();
  const locale = useLocale();
  const { supabase } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace("/sign-in");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-surface focus:p-2"
        href="#main"
      >
        {t("common.skipToContent")}
      </a>
      <header className="frame-b sticky top-0 z-40 bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link className="shrink-0" href="/">
            <BrandLogo ground="dark" height={56} locale={locale} />
            <span className="sr-only">{t("nexus.name")}</span>
          </Link>
          <nav
            aria-label={t("nexus.nav.label")}
            className="ms-auto hidden lg:block"
          >
            <NavLinks />
          </nav>
          <div className="ms-auto flex items-center gap-2 lg:ms-6">
            <LanguageSwitcher />
            <Button
              className="hidden lg:inline-flex"
              onClick={signOut}
              size="sm"
              variant="ghost"
            >
              {t("auth.signOut")}
            </Button>
            <Sheet onOpenChange={setOpen} open={open}>
              <SheetTrigger asChild>
                <Button className="lg:hidden" size="icon" variant="outline">
                  <MenuIcon aria-hidden="true" />
                  <span className="sr-only">{t("common.openMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                className="p-4"
                side={locale === "ar" ? "left" : "right"}
              >
                <SheetTitle className="type-subheading">
                  {t("nexus.name")}
                </SheetTitle>
                <nav aria-label={t("nexus.nav.label")} className="mt-4">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </nav>
                <Button
                  className="mt-6 w-full"
                  onClick={signOut}
                  variant="outline"
                >
                  {t("auth.signOut")}
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8" id="main">
        {children}
      </main>
      <footer className="frame-t">
        <p className="type-caption mx-auto w-full max-w-6xl px-4 py-4">
          <a
            className="underline-offset-4 hover:underline"
            href={`${project.hosts.web}/${locale}`}
          >
            {t("nexus.nav.publicSite")}
          </a>
        </p>
      </footer>
    </div>
  );
};

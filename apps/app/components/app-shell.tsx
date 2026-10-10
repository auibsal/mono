"use client";

import { useAuth } from "@repo/auth/provider";
import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
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
import { hasPermissionAnywhere } from "@repo/rbac";
import { content } from "@repo/sal-data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MenuIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { disablePush } from "@/lib/push";
import { useMemberStatus } from "@/lib/queries";
import { useVisibleModules } from "./admin/admin-shell";
import { useTwoStep } from "./auth/two-step";
import { LanguageSwitcher } from "./language-switcher";

// Five sections at most (v5); the account items live in their own menu.
const memberLinks = [
  { href: "/", key: "home" },
  { href: "/events", key: "events" },
  { href: "/programs", key: "programs" },
  { href: "/journal", key: "journal" },
  { href: "/society", key: "society" },
] as const;

/** Profile, and Administration for members whose roles open it. */
const useAccountLinks = () => {
  const { grants, visible } = useVisibleModules();
  const twoStep = useTwoStep();
  const admin = visible.length > 0 || Boolean(twoStep.data?.needs);
  const status = useMemberStatus();
  const handbook =
    hasPermissionAnywhere(grants.data, "library.read") ||
    hasPermissionAnywhere(grants.data, "governance.manage");
  // Form F-18: every role holder declares conflicts each semester (P8).
  const declares = (grants.data ?? []).length > 0;
  const member = Boolean(status.data?.is_member);
  return [
    { href: "/profile", key: "profile" },
    { href: "/service", key: "service" },
    { href: "/forms", key: "forms" },
    { href: "/documents", key: "documents" },
    ...(member ? [{ href: "/offers", key: "offers" } as const] : []),
    ...(handbook ? [{ href: "/handbook", key: "handbook" } as const] : []),
    ...(declares
      ? [{ href: "/declarations", key: "declarations" } as const]
      : []),
    ...(admin ? [{ href: "/admin", key: "admin" } as const] : []),
  ] as const;
};

/**
 * The team's Notion workspace, for role holders: team work (projects,
 * tasks, meetings, planning, the handbook) lives there.
 */
const useTeamWorkspace = () => {
  const { supabase } = useAuth();
  const { grants } = useVisibleModules();
  const officer = (grants.data ?? []).length > 0;
  const home = useQuery({
    enabled: officer,
    queryFn: () => content.publicSetting(supabase, "notion.home_url"),
    queryKey: ["setting", "notion.home_url"],
    staleTime: 3_600_000,
  });
  return officer && typeof home.data === "string" ? home.data : null;
};

const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
  const t = useTranslations("nexus.nav");
  const pathname = usePathname();
  const links = memberLinks;

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
  const account = useAccountLinks();
  const workspace = useTeamWorkspace();

  const signOut = async () => {
    // A shared computer must not show the last member's notices.
    await disablePush(supabase).catch(() => undefined);
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
      <header className="frame-b sticky top-0 z-40 bg-surface print:hidden">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="hidden lg:inline-flex"
                  size="sm"
                  variant="outline"
                >
                  {t("nexus.nav.account")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {account.map((link) => (
                  <DropdownMenuItem asChild key={link.href}>
                    <Link href={link.href}>{t(`nexus.nav.${link.key}`)}</Link>
                  </DropdownMenuItem>
                ))}
                {workspace ? (
                  <DropdownMenuItem asChild>
                    <a href={workspace} rel="noopener" target="_blank">
                      {t("nexus.nav.workspace")}
                      <ExternalLink
                        aria-label={t("common.externalLink")}
                        className="size-3.5"
                      />
                    </a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <ul className="mt-6 grid gap-2">
                  {account.map((link) => (
                    <li key={link.href}>
                      <Link
                        className="underline underline-offset-4"
                        href={link.href}
                        onClick={() => setOpen(false)}
                      >
                        {t(`nexus.nav.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                  {workspace ? (
                    <li>
                      <a
                        className="inline-flex items-center gap-1.5 underline underline-offset-4"
                        href={workspace}
                        rel="noopener"
                        target="_blank"
                      >
                        {t("nexus.nav.workspace")}
                        <ExternalLink
                          aria-label={t("common.externalLink")}
                          className="size-3.5"
                        />
                      </a>
                    </li>
                  ) : null}
                </ul>
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
      <footer className="frame-t print:hidden">
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

"use client";

import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Button } from "@repo/design-system/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@repo/design-system/components/ui/navigation-menu";
import { Link } from "@repo/internationalization/navigation";
import { Menu, MoveRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { env } from "@/env";
import { LanguageSwitcher } from "./language-switcher";

interface NavigationItem {
  description?: string;
  href?: string;
  items?: { href: string; title: string }[];
  title: string;
}

const isExternal = (href: string) => href.startsWith("http");

/** Locale-aware link for pages on this site, a plain link for others. */
const NavLink = ({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) =>
  isExternal(href) ? (
    <a
      className={className}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ) : (
    <Link className={className} href={href}>
      {children}
    </Link>
  );

export const Header = () => {
  const t = useTranslations("web");
  const common = useTranslations("common");
  const locale = useLocale();
  const [isOpen, setOpen] = useState(false);
  const appUrl = `${env.NEXT_PUBLIC_APP_URL}/${locale}`;
  const themeLabels = {
    dark: common("theme.dark"),
    light: common("theme.light"),
    system: common("theme.system"),
    toggle: common("theme.toggle"),
  };

  const navigationItems: NavigationItem[] = [
    { href: "/", title: t("header.home") },
    {
      description: t("header.product.description"),
      items: [{ href: "/pricing", title: t("header.product.pricing") }],
      title: t("header.product.title"),
    },
    // <module:cms>
    { href: "/blog", title: t("header.blog") },
    // </module:cms>
  ];

  if (env.NEXT_PUBLIC_DOCS_URL) {
    navigationItems.push({
      href: env.NEXT_PUBLIC_DOCS_URL,
      title: t("header.docs"),
    });
  }

  return (
    <header className="sticky start-0 top-0 z-40 w-full border-b bg-background">
      <div className="container relative mx-auto flex min-h-20 flex-row items-center gap-4 lg:grid lg:grid-cols-3">
        <div className="hidden flex-row items-center justify-start gap-4 lg:flex">
          <NavigationMenu className="flex items-start justify-start">
            <NavigationMenuList className="flex flex-row justify-start gap-4">
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  {item.href ? (
                    <NavigationMenuLink asChild>
                      <Button asChild variant="ghost">
                        <NavLink href={item.href}>{item.title}</NavLink>
                      </Button>
                    </NavigationMenuLink>
                  ) : (
                    <>
                      <NavigationMenuTrigger className="font-medium text-sm">
                        {item.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent className="!w-[450px] p-4">
                        <div className="flex grid-cols-2 flex-col gap-4 lg:grid">
                          <div className="flex h-full flex-col justify-between">
                            <div className="flex flex-col">
                              <p className="text-base">{item.title}</p>
                              <p className="text-muted-foreground text-sm">
                                {item.description}
                              </p>
                            </div>
                            <Button asChild className="mt-10" size="sm">
                              <Link href="/contact">
                                {t("global.primaryCta")}
                              </Link>
                            </Button>
                          </div>
                          <div className="flex h-full flex-col justify-end text-sm">
                            {item.items?.map((subItem) => (
                              <NavigationMenuLink asChild key={subItem.href}>
                                <Link
                                  className="flex flex-row items-center justify-between rounded px-4 py-2 hover:bg-muted"
                                  href={subItem.href}
                                >
                                  <span>{subItem.title}</span>
                                  <MoveRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                                </Link>
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center gap-2 lg:justify-center">
          <BrandLogo />
        </div>
        <div className="flex w-full justify-end gap-4">
          <Button asChild className="hidden md:inline" variant="ghost">
            <Link href="/contact">{t("header.contact")}</Link>
          </Button>
          <div className="hidden border-e md:inline" />
          <div className="hidden md:inline">
            <LanguageSwitcher />
          </div>
          <div className="hidden md:inline">
            <ModeToggle labels={themeLabels} />
          </div>
          <Button asChild className="hidden md:inline" variant="outline">
            <a href={`${appUrl}/sign-in`}>{t("header.signIn")}</a>
          </Button>
          <Button asChild>
            <a href={`${appUrl}/sign-up`}>{t("header.signUp")}</a>
          </Button>
        </div>
        <div className="flex w-12 shrink items-end justify-end lg:hidden">
          <Button
            aria-expanded={isOpen}
            aria-label={isOpen ? common("closeMenu") : common("openMenu")}
            onClick={() => setOpen(!isOpen)}
            variant="ghost"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          {isOpen ? (
            <div className="container absolute end-0 top-20 flex w-full flex-col gap-8 border-t bg-background py-4 shadow-lg">
              {navigationItems.map((item) => (
                <div key={item.title}>
                  <div className="flex flex-col gap-2">
                    {item.href ? (
                      <NavLink
                        className="flex items-center justify-between"
                        href={item.href}
                      >
                        <span className="text-lg">{item.title}</span>
                        <MoveRight className="h-4 w-4 stroke-1 text-muted-foreground rtl:rotate-180" />
                      </NavLink>
                    ) : (
                      <p className="text-lg">{item.title}</p>
                    )}
                    {item.items?.map((subItem) => (
                      <Link
                        className="flex items-center justify-between"
                        href={subItem.href}
                        key={subItem.title}
                      >
                        <span className="text-muted-foreground">
                          {subItem.title}
                        </span>
                        <MoveRight className="h-4 w-4 stroke-1 rtl:rotate-180" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <ModeToggle labels={themeLabels} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

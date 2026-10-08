"use client";

import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Sign-in, sign-up and password pages: one light sheet on ink, motto beneath. */
export const AuthFrame = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("common");
  const locale = useLocale();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <BrandLogo ground="dark" height={64} locale={locale} />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8" id="main">
        {/* Forms are always light (brand book): a white sheet on the ink ground. */}
        <div
          className="frame grid content-start gap-6 bg-surface p-6 text-text shadow-offset-accent"
          data-theme="light"
        >
          {children}
        </div>
      </main>
      <footer className="type-caption mx-auto w-full max-w-md px-4 py-6">
        <p lang="ar">{t("motto")}</p>
      </footer>
    </div>
  );
};

import { DesignSystemProvider } from "@repo/design-system";
import { getDirection, locales } from "@repo/internationalization";
import { routing } from "@repo/internationalization/routing";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { DocumentLanguage } from "@/components/document-language";
import { AppProviders } from "@/components/providers";

interface LocaleLayoutProperties {
  readonly children: ReactNode;
  readonly params: Promise<{
    locale: string;
  }>;
}

// Every page is prerendered once per language (also for the static export).
export const generateStaticParams = () => locales.map((locale) => ({ locale }));
export const dynamicParams = false;

const LocaleLayout = async ({ children, params }: LocaleLayoutProperties) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const dir = getDirection(locale);
  const { app, auth, billing, common } = await getMessages();

  return (
    <>
      <DocumentLanguage dir={dir} locale={locale} />
      <NextIntlClientProvider messages={{ app, auth, billing, common }}>
        <DesignSystemProvider dir={dir} labels={common.ui}>
          <AppProviders>{children}</AppProviders>
        </DesignSystemProvider>
      </NextIntlClientProvider>
    </>
  );
};

export default LocaleLayout;

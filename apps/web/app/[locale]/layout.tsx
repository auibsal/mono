import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { getDirection, locales } from "@repo/internationalization";
import { routing } from "@repo/internationalization/routing";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactNode } from "react";
import { JsonLd, organization } from "@/lib/json-ld";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

interface RootLayoutProperties {
  readonly children: ReactNode;
  readonly params: Promise<{
    locale: string;
  }>;
}

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

const RootLayout = async ({ children, params }: RootLayoutProperties) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Lets pages under this layout render statically.
  setRequestLocale(locale);
  const dir = getDirection(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  // Client components only need the shared and public-site texts.
  const { common, web } = await getMessages();

  return (
    <html className={fonts} dir={dir} lang={locale}>
      <body className="flex min-h-dvh flex-col bg-surface text-text">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-surface focus:p-2"
          href="#main"
        >
          {t("skipToContent")}
        </a>
        <JsonLd data={organization()} />
        <NextIntlClientProvider messages={{ common, web }}>
          <AnalyticsProvider>
            <DesignSystemProvider dir={dir} labels={common.ui}>
              <Header />
              <main className="flex-1" id="main">
                {children}
              </main>
              <Footer />
            </DesignSystemProvider>
          </AnalyticsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;

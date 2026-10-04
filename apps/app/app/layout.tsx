import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { project } from "@repo/config";
import { fonts } from "@repo/design-system/lib/fonts";
import {
  defaultLocale,
  getDirection,
  localeDefinitions,
} from "@repo/internationalization";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: project.name, template: `%s | ${project.name}` },
};

// Draw under the iOS notch / Android status bar; styles.css adds the insets.
export const viewport: Viewport = { viewportFit: "cover" };

const directions = Object.fromEntries(
  Object.entries(localeDefinitions).map(([locale, { dir }]) => [locale, dir])
);

// Runs before hydration on every full page load:
// - sets <html lang dir> from the URL's language, so Arabic pages never
//   flash left-to-right (client-side switches are handled by DocumentLanguage);
// - remembers the opened path: the native apps serve index.html for every
//   route, and the entry page restores it.
const bootstrapScript = `(() => {
  const directions = ${JSON.stringify(directions)};
  const locale = location.pathname.split("/")[1];
  if (directions[locale]) {
    document.documentElement.lang = locale;
    document.documentElement.dir = directions[locale];
  }
  window.__initialPath = location.pathname + location.search;
})();`;

interface RootLayoutProperties {
  readonly children: ReactNode;
}

/**
 * The only root layout. The language lives in the [locale] segment below,
 * which sets <html lang/dir>. A single root keeps every navigation
 * client-side, which the Capacitor build relies on.
 */
const RootLayout = ({ children }: RootLayoutProperties) => (
  // The [locale] layout switches lang/dir to the page's language.
  <html
    className={fonts}
    dir={getDirection(defaultLocale)}
    lang={defaultLocale}
    suppressHydrationWarning
  >
    <body>
      <Script id="bootstrap" strategy="beforeInteractive">
        {bootstrapScript}
      </Script>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </body>
  </html>
);

export default RootLayout;

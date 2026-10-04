import "./styles.css";
import { project } from "@repo/config";
import { fonts } from "@repo/design-system/lib/fonts";
import {
  defaultLocale,
  getDirection,
  localeDefinitions,
} from "@repo/internationalization";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // The Nexus is for members: keep it out of search engines.
  robots: { follow: false, index: false },
  title: {
    default: `The Nexus · ${project.shortName}`,
    template: "%s · The Nexus",
  },
};

const directions = Object.fromEntries(
  Object.entries(localeDefinitions).map(([locale, { dir }]) => [locale, dir])
);

// Sets <html lang dir> from the URL before the first paint, so Arabic pages
// never flash left-to-right (client-side switches: DocumentLanguage).
const bootstrapScript = `(() => {
  const directions = ${JSON.stringify(directions)};
  const locale = location.pathname.split("/")[1];
  if (directions[locale]) {
    document.documentElement.lang = locale;
    document.documentElement.dir = directions[locale];
  }
})();`;

interface RootLayoutProperties {
  readonly children: ReactNode;
}

/**
 * The only root layout; the language lives in the [locale] segment. A single
 * root keeps every navigation client-side, which the static export needs.
 */
const RootLayout = ({ children }: RootLayoutProperties) => (
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
      {children}
    </body>
  </html>
);

export default RootLayout;

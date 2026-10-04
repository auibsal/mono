import type { Locale } from "@repo/internationalization";
import { locales } from "@repo/internationalization";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";

interface PageMetadata {
  description: string;
  image?: string;
  title: string;
}

/**
 * Page metadata with the canonical URL for this language and hreflang links
 * to the same page in every other language.
 */
export const localizedMetadata = (
  locale: Locale,
  path: string,
  page: PageMetadata
): Metadata => {
  const suffix = path === "/" ? "" : path;

  return createMetadata({
    ...page,
    alternates: {
      canonical: `/${locale}${suffix}`,
      languages: Object.fromEntries(
        locales.map((language) => [language, `/${language}${suffix}`])
      ),
    },
    locale,
  });
};

import type { Locale } from "@repo/internationalization";
import { locales } from "@repo/internationalization";
import type { Metadata } from "next";
import { createMetadata } from "./create-metadata";

interface PageMetadata {
  description: string;
  /** A share image; otherwise one is drawn from the title (`/[locale]/og`). */
  image?: string;
  /** A short line above the title on the drawn share image. */
  kicker?: string;
  title: string;
}

/** The drawn share image for a page (apps/web/app/[locale]/og). */
export const ogImagePath = (
  locale: Locale,
  { kicker, title }: Pick<PageMetadata, "kicker" | "title">
) => {
  const query = new URLSearchParams({ title: title.slice(0, 120) });
  if (kicker) {
    query.set("kicker", kicker.slice(0, 80));
  }
  return `/${locale}/og?${query.toString()}`;
};

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

  const { kicker, ...rest } = page;
  return createMetadata({
    ...rest,
    alternates: {
      canonical: `/${locale}${suffix}`,
      languages: Object.fromEntries(
        locales.map((language) => [language, `/${language}${suffix}`])
      ),
    },
    image: page.image ?? ogImagePath(locale, { kicker, title: page.title }),
    locale,
  });
};

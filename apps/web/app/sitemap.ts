import { locales } from "@repo/internationalization";
import type { MetadataRoute } from "next";
import { env } from "@/env";

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith("https")
  ? "https"
  : "http";
const url = new URL(`${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL}`);

/** Pages without dynamic segments; add new ones here. */
const staticPaths = ["", "/pricing", "/contact"];

/** One entry per language, each listing its translations (hreflang). */
const localized = (path: string): MetadataRoute.Sitemap => {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, new URL(`/${locale}${path}`, url).href])
  );

  return locales.map((locale) => ({
    alternates: { languages },
    lastModified: new Date(),
    url: languages[locale] ?? url.href,
  }));
};

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  // Pages that come from other sources, e.g. the CMS.
  const dynamicPaths: string[][] = await Promise.all([]);

  return [...staticPaths, ...dynamicPaths.flat()].flatMap(localized);
};

export default sitemap;

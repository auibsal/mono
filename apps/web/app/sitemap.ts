// <module:cms>
import { blog, legal } from "@repo/cms";
// </module:cms>
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

// <module:cms>
const cmsPaths = async () => {
  const [posts, legalPages] = await Promise.all([
    blog.getPosts(),
    legal.getPosts(),
  ]);
  return [
    "/blog",
    ...posts.map((post) => `/blog/${post._slug}`),
    ...legalPages.map((page) => `/legal/${page._slug}`),
  ];
};
// </module:cms>

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  // Pages that come from other sources, e.g. the CMS.
  const dynamicPaths: string[][] = await Promise.all([
    // <module:cms>
    cmsPaths(),
    // </module:cms>
  ]);

  return [...staticPaths, ...dynamicPaths.flat()].flatMap(localized);
};

export default sitemap;

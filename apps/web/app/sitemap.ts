import { project } from "@repo/config";
import { locales } from "@repo/internationalization";
import { documents } from "@repo/sal-data";
import type { MetadataRoute } from "next";

/**
 * Only pages that exist, each with its Arabic/English alternates. Pages are
 * added here as they are built; members-only content never appears.
 */
const staticPaths = [
  "",
  "/about",
  "/programs",
  "/journal",
  "/join",
  "/give",
  "/news",
  "/contact",
  "/media-kit",
  "/privacy",
  "/side-quest/care",
  "/events",
  "/documents",
  ...documents.documents.map((doc) => `/documents/${doc.slug}`),
];

const localized = (path: string): MetadataRoute.Sitemap => {
  const languages = Object.fromEntries(
    locales.map((locale) => [
      locale,
      new URL(`/${locale}${path}`, project.hosts.web).href,
    ])
  );

  return locales.map((locale) => ({
    alternates: { languages },
    lastModified: new Date(),
    url: languages[locale] ?? project.hosts.web,
  }));
};

const sitemap = (): MetadataRoute.Sitemap => staticPaths.flatMap(localized);

export default sitemap;

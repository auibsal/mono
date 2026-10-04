import { project } from "@repo/config";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", disallow: ["/api/"], userAgent: "*" },
    sitemap: new URL("/sitemap.xml", project.hosts.web).href,
  };
}

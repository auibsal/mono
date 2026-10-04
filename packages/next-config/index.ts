import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

export const config: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);

/**
 * A static export (`out/`): apps/app (the Nexus) has no server. Rewrites,
 * redirects, headers and image optimization are dropped; security headers
 * come from vercel.json instead.
 */
export const withStaticExport = ({
  headers: _headers,
  redirects: _redirects,
  rewrites: _rewrites,
  skipTrailingSlashRedirect: _skip,
  ...sourceConfig
}: NextConfig): NextConfig => ({
  ...sourceConfig,
  images: { ...sourceConfig.images, unoptimized: true },
  output: "export",
});

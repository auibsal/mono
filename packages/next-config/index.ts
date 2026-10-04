import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

export const config: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },

  // biome-ignore lint/suspicious/useAwait: rewrites is async
  async rewrites() {
    return [
      {
        destination: "https://us-assets.i.posthog.com/static/:path*",
        source: "/ingest/static/:path*",
      },
      {
        destination: "https://us.i.posthog.com/:path*",
        source: "/ingest/:path*",
      },
      {
        destination: "https://us.i.posthog.com/decide",
        source: "/ingest/decide",
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);

/**
 * A static export (`out/`) for the Capacitor apps. There is no server, so
 * rewrites, redirects, headers and image optimization are dropped.
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

import { config, withAnalyzer, withStaticExport } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * The Nexus is a static export (`out/`): no server code, no secrets. Every
 * read and write goes to Supabase with the member's token (RLS decides) or
 * to apps/api. Security headers are set in vercel.json.
 */
let nextConfig: NextConfig = withStaticExport(withLogging(config));

if (env.VERCEL) {
  nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withNextIntl(nextConfig);

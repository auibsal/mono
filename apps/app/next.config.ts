import { config, withAnalyzer, withStaticExport } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import { securityHeaders } from "@repo/security/proxy";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * One app, two targets (see ARCHITECTURE_AND_INTEGRATIONS.md):
 * - web (default): a regular Next.js deployment with security headers;
 * - native (`BUILD_TARGET=native`): a static export in `out/` that Capacitor
 *   bundles into the iOS and Android apps.
 */
const isNativeBuild = process.env.BUILD_TARGET === "native";

let nextConfig: NextConfig = withLogging(config);

if (isNativeBuild) {
  // Both targets build in `.next`, which `next build` locks: run `build` and
  // `build:native` one after the other, not in the same turbo invocation.
  nextConfig = withStaticExport(nextConfig);
} else {
  nextConfig.headers = () => Promise.resolve(securityHeaders());

  if (env.VERCEL) {
    nextConfig = withSentry(nextConfig);
  }
}

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withNextIntl(nextConfig);

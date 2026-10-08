import { withLogtail } from "@logtail/next";
import { withSentryConfig } from "@sentry/nextjs";
import { keys } from "./keys";

export const sentryConfig: Parameters<typeof withSentryConfig>[1] = {
  org: keys().SENTRY_ORG,
  project: keys().SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  /*
   * No tunnelRoute: the Nexus is a static export and cannot serve the
   * rewrite. Browsers send events straight to ingest.de.sentry.io, which
   * every CSP allows (https://*.sentry.io).
   */

  webpack: {
    /*
     * Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
     * See the following for more information:
     * https://docs.sentry.io/product/crons/
     * https://vercel.com/docs/cron-jobs
     */
    automaticVercelMonitors: true,
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
  },

  /*
   * For all available options, see:
   * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
   */

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
};

export const withSentry = (sourceConfig: object): object => {
  const configWithTranspile = {
    ...sourceConfig,
    transpilePackages: ["@sentry/nextjs"],
  };

  return withSentryConfig(configWithTranspile, sentryConfig);
};

export const withLogging = (config: object): object => withLogtail(config);

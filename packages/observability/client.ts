/*
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    // Session Replay is off: it records members' screens, and the free plan
    // allows only 50 replays a month.
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
    // The free plan's span quota is small; one transaction in ten is enough.
    tracesSampleRate: 0.1,
  });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

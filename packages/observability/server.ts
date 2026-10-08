/*
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
    // Local variables can hold member data, so they are never sent.
    tracesSampleRate: 0.1,
  });

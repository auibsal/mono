import { logger } from "@sentry/nextjs";

type Level = "debug" | "info" | "warn" | "error";
type Attributes = Record<string, string | number | boolean>;

/**
 * Server logs: printed to the Vercel runtime log and sent to Sentry Logs
 * (`enableLogs` in the Sentry init), next to the errors they explain.
 */
const at =
  (level: Level) =>
  (message: string, attributes?: Attributes): void => {
    console[level](message, ...(attributes ? [attributes] : []));
    logger[level](message, attributes);
  };

export const log = {
  debug: at("debug"),
  error: at("error"),
  info: at("info"),
  warn: at("warn"),
};

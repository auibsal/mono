// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { log } from "./log";

export const parseError = (error: unknown): string => {
  let message: string;

  if (error instanceof Error) {
    ({ message } = error);
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    ({ message } = error as { message: string });
  } else {
    message = String(error);
  }

  try {
    Sentry.captureException(error);
    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    console.error("Error parsing error:", newError);
  }

  return message;
};

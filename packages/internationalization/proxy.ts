import createMiddleware from "next-intl/middleware";
import { routing } from "./routing";

/**
 * Redirects to the visitor's language (cookie, then Accept-Language, then the
 * project default) and keeps the locale prefix on every URL.
 */
export const internationalizationMiddleware = createMiddleware(routing);

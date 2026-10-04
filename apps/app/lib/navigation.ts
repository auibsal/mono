import { isLocale } from "@repo/internationalization";

/**
 * A post-sign-in destination taken from the URL. Only paths inside this app
 * are accepted, never absolute or protocol-relative URLs (open redirects).
 */
export const safeNextPath = (value: string | null | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null;

/** "/en/events?x" → "/events?x", for the locale-aware router. */
export const stripLocale = (path: string) => {
  const [, first, ...rest] = path.split("/");
  return isLocale(first) ? `/${rest.join("/")}` : path;
};

/** Where confirmation and magic links land, carrying the return path. */
export const callbackUrl = (locale: string, next: string | null) => {
  const url = new URL(`/${locale}/auth/callback`, window.location.origin);
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
};

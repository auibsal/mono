import { project } from "@repo/config";
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

/**
 * A return address on another Society site (the design system), after
 * sign-in. Only https URLs on the Society's own domain are accepted, so the
 * Nexus never sends anyone elsewhere.
 */
export const safeSocietyUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" &&
      (host === project.domain || host.endsWith(`.${project.domain}`))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

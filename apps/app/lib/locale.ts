import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@repo/internationalization";

const STORAGE_KEY = "locale";
const QUERY_OR_HASH = /(?=[?#])/;

const readStoredLocale = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Remembers the language the user picked (web and native). */
export const rememberLocale = (locale: Locale) => {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode); the URL still carries it.
  }
};

/**
 * The language to open: the user's last choice, else the first supported
 * browser/OS language (ar-IQ → ar), else the project default.
 */
export const preferredLocale = (
  stored: string | null = readStoredLocale(),
  languages: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages
): Locale => {
  if (isLocale(stored)) {
    return stored;
  }
  for (const language of languages) {
    const [base] = language.toLowerCase().split("-");
    if (isLocale(base)) {
      return base;
    }
  }
  return defaultLocale;
};

/**
 * Where to go for a URL that may lack a locale: locale-prefixed paths are
 * kept, others get the preferred locale (`/billing` → `/ar/billing`).
 */
export const resolveLocalizedPath = (path: string, locale: Locale) => {
  const [pathname = "/", search = ""] = path.split(QUERY_OR_HASH, 2);
  const [, first] = pathname.split("/");

  if (isLocale(first)) {
    return path;
  }

  const rest = pathname === "/" ? "" : pathname;
  return `/${locale}${rest}${search}`;
};

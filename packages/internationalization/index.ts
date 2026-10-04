import type {} from "./augment";
import { defaultLocale, isLocale } from "./config";
import type en from "./messages/en.json";

export {
  type Direction,
  defaultLocale,
  getDirection,
  getLocaleLabel,
  isLocale,
  type Locale,
  localeDefinitions,
  locales,
} from "./config";

export type Messages = typeof en;

/** Loads the messages for a locale, falling back to the default locale. */
export const getMessages = async (locale: string): Promise<Messages> =>
  (await import(`./messages/${isLocale(locale) ? locale : defaultLocale}.json`))
    .default;

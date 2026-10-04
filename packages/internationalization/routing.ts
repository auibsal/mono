import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

/**
 * Every URL carries its locale (/ar/…, /en/…). An explicit prefix also works
 * for the Capacitor static export, where no middleware can rewrite URLs.
 */
export const routing = defineRouting({
  defaultLocale,
  localePrefix: "always",
  locales,
});

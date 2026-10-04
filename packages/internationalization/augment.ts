// Loads next-intl's types so the augmentation below has a target in every
// program that includes this file.
import type {} from "next-intl";
import type en from "./messages/en.json";
import type { routing } from "./routing";

// Typed message keys and locales for useTranslations/getTranslations.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
  }
}

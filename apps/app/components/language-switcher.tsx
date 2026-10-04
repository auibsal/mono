"use client";

import { type Locale, locales } from "@repo/internationalization/config";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { useLocale, useTranslations } from "next-intl";
import { rememberLocale } from "@/lib/locale";

/**
 * Switches between English and Arabic, in words (the brand prefers words
 * to icons), and remembers the choice on this device.
 */
export const LanguageSwitcher = () => {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();
  const other = (locales.find((locale) => locale !== current) ??
    current) as Locale;

  return (
    <button
      aria-label={t("switchLanguage")}
      className="rounded-sm px-2 py-1 text-sm underline-offset-4 hover:underline"
      lang={other}
      onClick={() => {
        rememberLocale(other);
        router.replace(`${pathname}${window.location.search}`, {
          locale: other,
        });
      }}
      type="button"
    >
      {t("otherLanguage")}
    </button>
  );
};

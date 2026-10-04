"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  getLocaleLabel,
  type Locale,
  locales,
} from "@repo/internationalization/config";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { rememberLocale } from "@/lib/locale";

/** Switches the app language and remembers the choice on this device. */
export const LanguageSwitcher = () => {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();

  const switchTo = (locale: Locale) => {
    rememberLocale(locale);
    router.replace(`${pathname}${window.location.search}`, { locale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="shrink-0" size="icon" variant="ghost">
          <Languages className="size-4" />
          <span className="sr-only">{t("switchLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {locales.map((locale) => (
          <DropdownMenuItem
            disabled={locale === current}
            key={locale}
            lang={locale}
            onClick={() => switchTo(locale)}
          >
            {getLocaleLabel(locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

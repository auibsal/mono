"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { getLocaleLabel, locales } from "@repo/internationalization/config";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export const LanguageSwitcher = () => {
  const t = useTranslations("common");
  const router = useRouter();
  // The current path without its locale prefix.
  const pathname = usePathname();
  const current = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="shrink-0 text-foreground"
          size="icon"
          variant="ghost"
        >
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("switchLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {locales.map((locale) => (
          <DropdownMenuItem
            disabled={locale === current}
            key={locale}
            lang={locale}
            onClick={() => router.replace(pathname, { locale })}
          >
            {getLocaleLabel(locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

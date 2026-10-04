"use client";

import { track } from "@repo/analytics/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { useRouter } from "@repo/internationalization/navigation";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

export const SearchForm = () => {
  const t = useTranslations("app.search");
  const router = useRouter();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "");
    if (query.trim()) {
      track("search", { query: query.trim() });
      router.push({ pathname: "/search", query: { q: query.trim() } });
    }
  };

  return (
    <search>
      <form className="relative" onSubmit={submit}>
        <div className="absolute start-px top-px bottom-px flex h-8 w-8 items-center justify-center">
          <SearchIcon className="text-muted-foreground" size={16} />
        </div>
        <Input
          aria-label={t("placeholder")}
          className="h-auto w-40 bg-background py-1.5 ps-8 pe-9 text-xs sm:w-56"
          name="q"
          placeholder={t("placeholder")}
          type="search"
        />
        <Button
          className="absolute end-px top-px bottom-px h-8 w-8"
          size="icon"
          type="submit"
          variant="ghost"
        >
          <ArrowRightIcon
            className="text-muted-foreground rtl:rotate-180"
            size={16}
          />
          <span className="sr-only">{t("submit")}</span>
        </Button>
      </form>
    </search>
  );
};

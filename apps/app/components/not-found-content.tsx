"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { getDirection, isLocale } from "@repo/internationalization/config";
import ar from "@repo/internationalization/messages/ar.json";
import en from "@repo/internationalization/messages/en.json";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LocaleRedirect } from "./locale-redirect";

const texts = { ar: ar.common, ckb: ar.common, en: en.common };

/**
 * Root 404. Paths without a language ("/billing") are redirected to the
 * localized page; anything else shows a not-found message.
 */
export const NotFoundContent = () => {
  const [, segment] = usePathname().split("/");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isLocale(segment)) {
    return mounted ? <LocaleRedirect /> : null;
  }

  const t = texts[segment].notFound;

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
      dir={getDirection(segment)}
      lang={segment}
    >
      <h1 className="font-semibold text-2xl">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.description}</p>
      <Button asChild>
        <Link href={`/${segment}`}>{t.home}</Link>
      </Button>
    </div>
  );
};

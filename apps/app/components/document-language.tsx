"use client";

import { useEffect } from "react";

interface DocumentLanguageProps {
  readonly dir: "ltr" | "rtl";
  readonly locale: string;
}

/**
 * Keeps <html lang dir> in sync after switching language in the app (the
 * root layout's bootstrap script sets them on the first load).
 */
export const DocumentLanguage = ({ dir, locale }: DocumentLanguageProps) => {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [dir, locale]);

  return null;
};

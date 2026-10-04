"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { preferredLocale, resolveLocalizedPath } from "@/lib/locale";

declare global {
  interface Window {
    __initialPath?: string;
  }
}

/**
 * Sends the visitor to a locale-prefixed URL: "/" opens the preferred
 * language and "/billing" becomes "/ar/billing". Client-side, so it works in
 * the static export where no proxy runs.
 */
export const LocaleRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    const path =
      window.__initialPath ?? window.location.pathname + window.location.search;
    window.__initialPath = undefined;
    router.replace(resolveLocalizedPath(path, preferredLocale()));
  }, [router]);

  return null;
};

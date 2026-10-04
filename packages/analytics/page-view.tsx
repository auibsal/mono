"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { rememberClickIds, trackPageView } from "./client";

/** Reports a page view to the ad and analytics tags on every navigation. */
export const PageViewTracker = () => {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const path = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    rememberClickIds();
    trackPageView(new URL(path, window.location.origin).toString());
  }, [path]);

  return null;
};

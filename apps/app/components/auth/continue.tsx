"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { safeSocietyUrl } from "@/lib/navigation";
import { FullPageSpinner } from "../states";

/**
 * Back to the Society site that sent the member here (the design system),
 * now that their session cookie is fresh. Anything else goes to Home.
 */
export const ContinueToSite = () => {
  const t = useTranslations("auth.continue");
  const to = safeSocietyUrl(useSearchParams().get("to"));

  useEffect(() => {
    window.location.replace(to ?? "/");
  }, [to]);

  return (
    <>
      <FullPageSpinner />
      <p className="sr-only" role="status">
        {t("returning")}
      </p>
    </>
  );
};

"use client";

import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { useTranslations } from "next-intl";

export const ThemeToggle = () => {
  const t = useTranslations("common.theme");

  return (
    <ModeToggle
      labels={{
        dark: t("dark"),
        light: t("light"),
        system: t("system"),
        toggle: t("toggle"),
      }}
    />
  );
};

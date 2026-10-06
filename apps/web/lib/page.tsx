import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localizedMetadata } from "./metadata";

export interface LocaleParams {
  readonly params: Promise<{ locale: Locale }>;
}

/** Metadata for a simple section page: its `title` and `lede` messages. */
export const sectionMetadata =
  (namespace: "web.about" | "web.join" | "web.programmes", path: string) =>
  async ({ params }: LocaleParams): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return localizedMetadata(locale, path, {
      description: t("lede"),
      title: t("title"),
    });
  };

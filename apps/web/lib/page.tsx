import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localizedMetadata } from "./metadata";

export interface LocaleParams {
  readonly params: Promise<{ locale: Locale }>;
}

type SectionNamespace =
  | "web.about"
  | "web.care"
  | "web.contact"
  | "web.give"
  | "web.join"
  | "web.mediaKit"
  | "web.news"
  | "web.partners"
  | "web.privacy"
  | "web.programmes";

/** Metadata for a simple section page: its `title` and `lede` messages. */
export const sectionMetadata =
  (namespace: SectionNamespace, path: string) =>
  async ({ params }: LocaleParams): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return localizedMetadata(locale, path, {
      description: t("lede"),
      title: t("title"),
    });
  };

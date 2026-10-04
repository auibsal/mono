import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export interface LocaleParams {
  params: Promise<{ locale: Locale }>;
}

type Translator = Awaited<ReturnType<typeof getTranslations<never>>>;

/** generateMetadata for a page whose title is a message. */
export const titleFrom =
  (pick: (t: Translator) => string) =>
  async ({ params }: LocaleParams): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale });
    return { title: pick(t as Translator) };
  };

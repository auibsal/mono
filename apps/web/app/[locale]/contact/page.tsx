import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedMetadata } from "@/lib/metadata";
import { ContactForm } from "./components/contact-form";

interface ContactProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export const generateMetadata = async ({
  params,
}: ContactProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.contact.meta" });

  return localizedMetadata(locale, "/contact", {
    description: t("description"),
    title: t("title"),
  });
};

const Contact = async ({ params }: ContactProps) => {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ContactForm />;
};

export default Contact;

import { legal } from "@repo/cms";
import { getTranslations } from "next-intl/server";
import { FooterColumn } from "./footer-column";

export const FooterLegalColumn = async () => {
  const [legalPages, t] = await Promise.all([
    legal.getPostsMeta(),
    getTranslations("web.footer"),
  ]);

  return (
    <FooterColumn
      items={legalPages.map((post) => ({
        href: `/legal/${post._slug}`,
        title: post._title,
      }))}
      title={t("legal")}
    />
  );
};

import { project } from "@repo/config";
import { Status } from "@repo/observability/status";
import { getTranslations } from "next-intl/server";
import { env } from "@/env";
import { FooterColumn, type FooterLink } from "./footer-column";
import { FooterLegalColumn } from "./footer-legal-column";

export const Footer = async () => {
  const t = await getTranslations();
  const pages: FooterLink[] = [
    // <module:cms>
    { href: "/blog", title: t("web.footer.blog") },
    // </module:cms>
  ];

  if (env.NEXT_PUBLIC_DOCS_URL) {
    pages.push({ href: env.NEXT_PUBLIC_DOCS_URL, title: t("web.footer.docs") });
  }

  return (
    <section className="dark border-foreground/10 border-t">
      <div className="w-full bg-background py-20 text-foreground lg:py-40">
        <div className="container mx-auto">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col items-start gap-8">
              <div className="flex flex-col gap-2">
                <h2 className="max-w-xl text-start font-regular text-3xl tracking-tighter md:text-5xl">
                  {project.name}
                </h2>
              </div>
              <Status
                labels={{
                  degraded: t("common.status.degraded"),
                  operational: t("common.status.operational"),
                  partial: t("common.status.partial"),
                  unknown: t("common.status.unknown"),
                }}
              />
            </div>
            <div className="grid items-start gap-10 lg:grid-cols-3">
              <FooterColumn href="/" title={t("web.footer.home")} />
              {pages.length > 0 ? (
                <FooterColumn items={pages} title={t("web.footer.pages")} />
              ) : null}
              {/* <module:cms> */}
              <FooterLegalColumn />
              {/* </module:cms> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

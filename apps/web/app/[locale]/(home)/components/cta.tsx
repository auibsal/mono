import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/navigation";
import { MoveRight, PhoneCall } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { env } from "@/env";

export const CTA = () => {
  const t = useTranslations("web");
  const locale = useLocale();

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-8 rounded-md bg-muted p-4 text-center lg:p-14">
          <div className="flex flex-col gap-2">
            <h3 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
              {t("home.cta.title")}
            </h3>
            <p className="max-w-xl text-lg text-muted-foreground leading-relaxed tracking-tight">
              {t("home.cta.description")}
            </p>
          </div>
          <div className="flex flex-row gap-4">
            <Button asChild className="gap-4" variant="outline">
              <Link href="/contact">
                {t("global.primaryCta")} <PhoneCall className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="gap-4">
              <a href={`${env.NEXT_PUBLIC_APP_URL}/${locale}/sign-up`}>
                {t("global.secondaryCta")}{" "}
                <MoveRight className="h-4 w-4 rtl:rotate-180" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

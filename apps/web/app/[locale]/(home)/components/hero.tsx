import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/navigation";
import { MoveRight, PhoneCall } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { env } from "@/env";
import { LatestPostAnnouncement } from "./latest-post-announcement";

export const Hero = () => {
  const t = useTranslations("web.home");
  const locale = useLocale();

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-40">
          {/* <module:cms> */}
          <LatestPostAnnouncement label={t("hero.announcement")} />
          {/* </module:cms> */}
          <div className="flex flex-col gap-4">
            <h1 className="max-w-2xl text-center font-regular text-5xl tracking-tighter md:text-7xl">
              {t("meta.title")}
            </h1>
            <p className="max-w-2xl text-center text-lg text-muted-foreground leading-relaxed tracking-tight md:text-xl">
              {t("meta.description")}
            </p>
          </div>
          <div className="flex flex-row gap-3">
            <Button asChild className="gap-4" size="lg" variant="outline">
              <Link href="/contact">
                {t("hero.contact")} <PhoneCall className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="gap-4" size="lg">
              <a href={`${env.NEXT_PUBLIC_APP_URL}/${locale}/sign-up`}>
                {t("hero.signUp")}{" "}
                <MoveRight className="h-4 w-4 rtl:rotate-180" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

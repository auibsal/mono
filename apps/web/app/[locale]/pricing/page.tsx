import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import {
  formatCurrency,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { Check, Minus, MoveRight, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { env } from "@/env";
import { localizedMetadata } from "@/lib/metadata";

interface PricingProps {
  params: Promise<{
    locale: Locale;
  }>;
}

type PlanId = "starter" | "growth" | "enterprise";
type FeatureId =
  | "sso"
  | "ai"
  | "history"
  | "members"
  | "collaboration"
  | "automation";

/**
 * Example plans: replace the prices (IQD per month, `null` = on request) and
 * the feature matrix with your own. Names and descriptions are translated in
 * the `web.pricing` messages.
 */
const plans: { id: PlanId; price: number | null }[] = [
  { id: "starter", price: 25_000 },
  { id: "growth", price: 75_000 },
  { id: "enterprise", price: null },
];

/** One value per plan: included or not, or a number (team members). */
const features: { id: FeatureId; values: (boolean | number)[] }[] = [
  { id: "sso", values: [true, true, true] },
  { id: "ai", values: [false, true, true] },
  { id: "history", values: [false, true, true] },
  { id: "members", values: [5, 25, 100] },
  { id: "collaboration", values: [false, true, true] },
  { id: "automation", values: [false, true, true] },
];

export const generateMetadata = async ({
  params,
}: PricingProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.pricing.meta" });

  return localizedMetadata(locale, "/pricing", {
    description: t("description"),
    title: t("title"),
  });
};

const Pricing = async ({ params }: PricingProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("web.pricing");
  const signUpUrl = `${env.NEXT_PUBLIC_APP_URL}/${locale}/sign-up`;

  const featureValue = (value: boolean | number, isLast: boolean) => {
    if (typeof value === "number") {
      const members = `${formatNumber(value, locale)}${isLast ? "+" : ""}`;
      return (
        <p className="text-muted-foreground text-sm">
          {t("members", { count: value, members })}
        </p>
      );
    }
    return value ? (
      <>
        <Check aria-hidden className="h-4 w-4 text-primary" />
        <span className="sr-only">{t("included")}</span>
      </>
    ) : (
      <>
        <Minus aria-hidden className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">{t("notIncluded")}</span>
      </>
    );
  };

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="max-w-xl text-center font-regular text-3xl tracking-tighter md:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-center text-lg text-muted-foreground leading-relaxed tracking-tight">
              {t("description")}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 divide-x pt-20 text-start lg:grid-cols-4">
            <div className="col-span-3 lg:col-span-1" />
            {plans.map((plan) => (
              <div
                className="flex flex-col gap-2 px-3 py-1 md:px-6 md:py-4"
                key={plan.id}
              >
                <p className="text-2xl">{t(`plans.${plan.id}.name`)}</p>
                <p className="text-muted-foreground text-sm">
                  {t(`plans.${plan.id}.description`)}
                </p>
                <p className="mt-8 flex flex-col gap-2 text-xl lg:flex-row lg:items-center">
                  {plan.price === null ? (
                    <span className="text-4xl">{t("custom")}</span>
                  ) : (
                    <>
                      <span className="text-4xl">
                        {formatCurrency(plan.price, locale)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {t("perMonth")}
                      </span>
                    </>
                  )}
                </p>
                <Button
                  asChild
                  className="mt-8 gap-4"
                  variant={plan.id === "growth" ? "default" : "outline"}
                >
                  {plan.price === null ? (
                    <Link href="/contact">
                      {t("contactUs")} <PhoneCall className="h-4 w-4" />
                    </Link>
                  ) : (
                    <a href={signUpUrl}>
                      {t("tryIt")}{" "}
                      <MoveRight className="h-4 w-4 rtl:rotate-180" />
                    </a>
                  )}
                </Button>
              </div>
            ))}
            <div className="col-span-3 px-3 py-4 lg:col-span-1 lg:px-6">
              <b>{t("featuresTitle")}</b>
            </div>
            <div />
            <div />
            <div />
            {features.map((feature) => (
              <div className="contents" key={feature.id}>
                <div className="col-span-3 px-3 py-4 lg:col-span-1 lg:px-6">
                  {t(`features.${feature.id}`)}
                </div>
                {feature.values.map((value, index) => (
                  <div
                    className="flex justify-center px-3 py-1 md:px-6 md:py-4"
                    key={plans[index]?.id}
                  >
                    {featureValue(value, index === feature.values.length - 1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;

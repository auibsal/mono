"use client";

import { getAttribution, track } from "@repo/analytics/client";
import { useAuth } from "@repo/auth/provider";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { formatCurrency, formatDate } from "@repo/internationalization/format";
import { getPurchasePolicy } from "@repo/payments";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";
import { ErrorState, SectionSpinner } from "@/components/states";
import { env } from "@/env";
import { callApi } from "@/lib/api";
import {
  rememberCheckout,
  reportCompletedCheckout,
} from "@/lib/checkout-tracking";
import { detectPlatform, isNativeApp } from "@/lib/platform";
import { usePayments, usePlans, useSubscription } from "@/lib/queries";

/** Opens the hosted checkout: same tab on the web, the system browser in the apps. */
const openCheckout = async (url: string) => {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.location.assign(url);
  }
};

export const Billing = () => {
  const t = useTranslations("billing");
  const locale = useLocale();
  const { supabase } = useAuth();
  const { active, canManage } = useOrganization();
  const plans = usePlans();
  const subscription = useSubscription(active.id);
  const payments = usePayments(active.id, canManage);
  const [checkoutError, setCheckoutError] = useState(false);
  // Digital goods can't use a third-party checkout inside the iOS/Android
  // apps (see @repo/payments policy and commerce.allowNativeCheckout).
  const policy = getPurchasePolicy(detectPlatform());

  type Plan = NonNullable<typeof plans.data>[number];

  const checkout = useMutation({
    mutationFn: (plan: Plan) =>
      callApi<{ referenceId: string; url: string | null }>(
        supabase,
        "/checkout",
        {
          attribution: getAttribution(),
          organizationId: active.id,
          planId: plan.id,
          // The API only accepts its own app URL; the apps return by themselves.
          redirectUrl: isNativeApp()
            ? undefined
            : `${env.NEXT_PUBLIC_APP_URL}/${locale}/billing`,
        }
      ),
    onError: () => setCheckoutError(true),
    onSuccess: async ({ referenceId, url }, plan) => {
      if (url) {
        rememberCheckout({
          currency: plan.currency,
          planId: plan.id,
          planName: plan.name,
          referenceId,
          value: plan.amount,
        });
        await openCheckout(url);
      }
    },
  });

  const startCheckout = (plan: Plan) => {
    setCheckoutError(false);
    track("begin_checkout", {
      currency: plan.currency,
      items: [
        { id: plan.id, name: plan.name, price: plan.amount, quantity: 1 },
      ],
      value: plan.amount,
    });
    checkout.mutate(plan);
  };

  // Back from the hosted checkout: report the purchase once it is paid.
  useEffect(() => {
    if (payments.data) {
      reportCompletedCheckout(payments.data);
    }
  }, [payments.data]);

  const currentPlan = plans.data?.find(
    (plan) => plan.id === subscription.data?.plan_id
  );

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <p className="text-muted-foreground">{t("description")}</p>

        <Card>
          <CardHeader>
            <CardTitle>{t("currentPlan")}</CardTitle>
            <CardDescription>
              {subscription.data && currentPlan ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {currentPlan.name}
                  </span>
                  <Badge variant="secondary">
                    {t(`status.${subscription.data.status}`)}
                  </Badge>
                  {subscription.data.current_period_end ? (
                    <span>
                      {t("renews", {
                        date: formatDate(
                          subscription.data.current_period_end,
                          locale
                        ),
                      })}
                    </span>
                  ) : null}
                </span>
              ) : (
                t("noPlan")
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4">
          <h2 className="font-semibold text-lg">{t("choosePlan")}</h2>
          {policy.allowed ? null : (
            <p className="rounded-md bg-muted p-4 text-sm">{t("webOnly")}</p>
          )}
          {canManage ? null : (
            <p className="text-muted-foreground text-sm">{t("managersOnly")}</p>
          )}
          {plans.isPending ? <SectionSpinner /> : null}
          {plans.isError ? (
            <ErrorState onRetry={() => plans.refetch()} />
          ) : null}
          {plans.data?.length === 0 ? (
            <p className="text-muted-foreground">{t("noPlans")}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.data?.map((plan) => {
              const isCurrent = plan.id === subscription.data?.plan_id;
              const price = formatCurrency(plan.amount, locale, plan.currency);
              return (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="font-semibold text-2xl text-foreground">
                        {price}
                      </span>{" "}
                      {plan.billing_interval === "year"
                        ? t("perYear")
                        : t("perMonth")}
                    </CardDescription>
                  </CardHeader>
                  {policy.allowed && canManage ? (
                    <CardContent>
                      <Button
                        className="w-full"
                        disabled={checkout.isPending}
                        onClick={() => startCheckout(plan)}
                        variant={isCurrent ? "outline" : "default"}
                      >
                        {checkout.isPending &&
                        checkout.variables?.id === plan.id
                          ? t("redirecting")
                          : t("pay", { amount: price })}
                      </Button>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
          {checkoutError ? (
            <p className="text-destructive text-sm" role="alert">
              {t("errors.checkout")}
            </p>
          ) : null}
        </section>

        {canManage ? (
          <section className="grid gap-3">
            <h2 className="font-semibold text-lg">{t("payments")}</h2>
            {payments.data?.length ? (
              <ul className="divide-y rounded-md border">
                {payments.data.map((payment) => (
                  <li
                    className="flex items-center justify-between gap-4 p-3 text-sm"
                    key={payment.id}
                  >
                    <div className="grid gap-0.5">
                      <span>{payment.description}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(payment.created_at, locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">
                        {formatCurrency(
                          payment.amount,
                          locale,
                          payment.currency
                        )}
                      </span>
                      <Badge variant="outline">
                        {t(`paymentStatus.${payment.status}`)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noPayments")}</p>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
};

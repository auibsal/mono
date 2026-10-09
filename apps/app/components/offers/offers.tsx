"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { formatLongDate } from "@repo/internationalization/format";
import { localized, partners } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";

/**
 * Offers from the Society's partners, for verified members. Nothing is paid
 * through the platform: each offer says how to redeem it, usually by
 * showing the membership card in the Nexus.
 */
export const Offers = () => {
  const t = useTranslations("nexus.offers");
  const locale = useLocale();
  const { supabase } = useAuth();
  const offers = useQuery({
    queryFn: () => partners.memberOffers(supabase),
    queryKey: ["offers"],
  });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <FormHeader title={t("title")}>{t("lede")}</FormHeader>
      {offers.isPending ? <SectionSpinner /> : null}
      {offers.isError ? <ErrorState /> : null}
      {offers.data?.length === 0 ? (
        <EmptyLine action={{ href: "/", label: t("membershipCard") }}>
          {t("empty")}
        </EmptyLine>
      ) : null}
      <ul className="grid gap-gap">
        {(offers.data ?? []).map((offer) => (
          <li key={offer.id}>
            <SalCard>
              <div className="grid gap-2">
                <h2 className="type-subheading">
                  {localized(offer, "title", locale)}
                </h2>
                <p className="type-body whitespace-pre-line" dir="auto">
                  {localized(offer, "details", locale)}
                </p>
                {offer.code ? (
                  <p className="type-body">
                    {t("code")}{" "}
                    <code className="type-code" dir="ltr">
                      {offer.code}
                    </code>
                  </p>
                ) : null}
                {offer.ends_on ? (
                  <p className="type-caption">
                    {t("until", {
                      date: formatLongDate(offer.ends_on, locale),
                    })}
                  </p>
                ) : null}
              </div>
            </SalCard>
          </li>
        ))}
      </ul>
    </div>
  );
};

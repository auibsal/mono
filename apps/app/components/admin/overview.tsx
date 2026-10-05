"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import type { Locale } from "@repo/internationalization";
import { formatIqd, formatNumber } from "@repo/internationalization/format";
import { localized, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ErrorState, SectionSpinner } from "../states";
import { AdminHeading } from "./kit";

interface Overview {
  campaigns?: {
    campaign_id: string;
    counted_iqd: number;
    pending_iqd: number;
    title_ar: string;
    title_en: string;
  }[];
  members?: number;
  open_submissions?: number;
  upcoming_rsvps?: number;
  verification_pending?: number;
  voting_members?: number;
}

const Figure = ({ label, value }: { label: string; value: number }) => (
  <SalCard>
    <p className="type-kicker">{label}</p>
    <p className="font-bold text-4xl text-title tabular-nums">
      {formatNumber(value)}
    </p>
  </SalCard>
);

export const AdminOverview = () => {
  const t = useTranslations("nexus.admin.overview");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const overview = useQuery({
    queryFn: async () =>
      (unwrap(await supabase.schema("core").rpc("admin_overview")) ??
        {}) as Overview,
    queryKey: ["admin", "overview"],
  });

  if (overview.isPending) {
    return <SectionSpinner />;
  }
  if (overview.isError) {
    return <ErrorState onRetry={() => overview.refetch()} />;
  }

  const o = overview.data;
  const figures = [
    ["members", o.members],
    ["votingMembers", o.voting_members],
    ["verificationPending", o.verification_pending],
    ["upcomingRsvps", o.upcoming_rsvps],
    ["openSubmissions", o.open_submissions],
  ] as const;
  const shown = figures.filter(([, value]) => value !== undefined);

  return (
    <div className="grid gap-8">
      <AdminHeading title={t("title")} />
      {shown.length === 0 && !o.campaigns ? (
        <p className="type-body text-text-secondary">{t("nothing")}</p>
      ) : null}
      {shown.length > 0 ? (
        <div className="grid gap-gap sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(([key, value]) => (
            <Figure key={key} label={t(key)} value={value ?? 0} />
          ))}
        </div>
      ) : null}
      {o.campaigns ? (
        <section className="grid gap-3">
          <h2 className="type-heading">{t("campaigns")}</h2>
          {o.campaigns.length === 0 ? (
            <p className="type-body text-text-secondary">{t("noCampaigns")}</p>
          ) : (
            <ul className="grid gap-gap sm:grid-cols-2">
              {o.campaigns.map((c) => (
                <li key={c.campaign_id}>
                  <SalCard>
                    <p className="font-bold">{localized(c, "title", locale)}</p>
                    <p className="font-bold text-2xl text-title tabular-nums">
                      {t("counted", {
                        amount: formatIqd(c.counted_iqd, locale),
                      })}
                    </p>
                    {c.pending_iqd > 0 ? (
                      <p className="type-caption">
                        {t("pending", {
                          amount: formatIqd(c.pending_iqd, locale),
                        })}
                      </p>
                    ) : null}
                  </SalCard>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { formatLongDate } from "@repo/internationalization/format";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "react-qr-code";
import { useMemberStatus, useProfile } from "@/lib/queries";

/** Membership card with the member's check-in code. */
export const MembershipCard = () => {
  const t = useTranslations("nexus.home");
  const locale = useLocale() as "en" | "ar";
  const { user } = useAuth();
  const status = useMemberStatus();
  const profile = useProfile();

  if (!(status.data && profile.data && user)) {
    return null;
  }

  const name =
    (locale === "ar" && profile.data.full_name_ar) || profile.data.full_name_en;

  return (
    <SalCard
      aria-labelledby="membership-card"
      className="sm:grid-cols-[1fr_auto]"
    >
      <div className="grid content-start gap-2">
        <p className="type-kicker">{t("card.title")}</p>
        <h2 className="type-heading" id="membership-card">
          {name}
        </h2>
        {status.data.member_since ? (
          <p className="type-body">
            {t("card.memberSince", {
              date: formatLongDate(status.data.member_since, locale, true),
            })}
          </p>
        ) : null}
        <dl className="type-body grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-text-secondary">{t("card.tier")}</dt>
          <dd>{status.data.tier ? t(`tiers.${status.data.tier}`) : "—"}</dd>
        </dl>
        <p
          className={
            status.data.voting_member
              ? "font-bold text-title"
              : "text-text-secondary"
          }
        >
          {status.data.voting_member ? t("card.voting") : t("card.notVoting")}
        </p>
      </div>
      <figure className="grid justify-items-center gap-2">
        <div className="rounded-card bg-surface p-3">
          <QRCode
            aria-hidden="true"
            size={132}
            value={`sal:member:${user.id}`}
          />
        </div>
        <figcaption className="type-caption max-w-40 text-center">
          {t("card.qr")}
        </figcaption>
      </figure>
    </SalCard>
  );
};

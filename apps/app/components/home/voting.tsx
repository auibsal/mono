"use client";

import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { localized, membership } from "@repo/sal-data";
import { useLocale, useTranslations } from "next-intl";
import { useActivity, useMemberStatus } from "@/lib/queries";
import { EmptyLine } from "../states";
import { Section } from "./section";

export const VotingEligibility = () => {
  const t = useTranslations("nexus.home.voting");
  const locale = useLocale() as "en" | "ar";
  const status = useMemberStatus();
  const activity = useActivity();
  const count = status.data?.activities ?? 0;

  return (
    <Section id="voting" title={t("title")}>
      <p className="type-body font-bold">
        {t("progress", { count: formatNumber(Math.min(count, 99)) })}
      </p>
      <progress
        aria-label={t("title")}
        className="h-2 w-full accent-[var(--title)]"
        max={membership.VOTING_ACTIVITIES}
        value={Math.min(count, membership.VOTING_ACTIVITIES)}
      />
      <p className="type-caption">{t("rule")}</p>
      <details>
        <summary className="cursor-pointer text-sm underline underline-offset-4">
          {t("history")}
        </summary>
        {activity.data?.length ? (
          <table className="type-body mt-2 w-full text-start">
            <tbody>
              {activity.data.map((record) => (
                <tr className="border-rule border-b" key={record.id}>
                  <td className="py-2 pe-4">
                    {formatLongDate(record.occurred_at, locale, true)}
                  </td>
                  <td className="py-2">
                    {record.event
                      ? localized(record.event, "title", locale)
                      : (record.note ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyLine>{t("noHistory")}</EmptyLine>
        )}
      </details>
    </Section>
  );
};

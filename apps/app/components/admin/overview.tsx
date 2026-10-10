"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import type { Locale } from "@repo/internationalization";
import {
  formatIqd,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
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
  intake_oldest_at?: string | null;
  members?: number;
  next_event?: {
    booked: number;
    capacity: number | null;
    starts_at: string;
    title_ar: string;
    title_en: string;
  } | null;
  open_submissions?: number;
  submissions_by_status?: Partial<Record<string, number>>;
  upcoming_rsvps?: number;
  verification_oldest_at?: string | null;
  verification_pending?: number;
  voting_members?: number;
}

/** One figure with the sentence that says what it means, and where to act. */
const Figure = ({
  action,
  detail,
  href,
  label,
  value,
}: {
  readonly action?: string;
  readonly detail: string;
  readonly href?: string;
  readonly label: string;
  readonly value: number;
}) => (
  <SalCard className="content-start gap-2 p-4 sm:gap-3 sm:p-card-padding">
    <p className="type-kicker">{label}</p>
    <p className="font-bold text-3xl text-title tabular-nums sm:text-4xl">
      {formatNumber(value)}
    </p>
    <p className="sm:type-body text-sm">{detail}</p>
    {action && href ? (
      <Link
        className="type-label justify-self-start text-xs underline underline-offset-4"
        href={href}
      >
        {action}
      </Link>
    ) : null}
  </SalCard>
);

type T = ReturnType<typeof useTranslations<"nexus.admin.overview">>;
type FigureProps = Parameters<typeof Figure>[0];

const membersFigure = (o: Overview, t: T): FigureProps | null =>
  o.members === undefined
    ? null
    : {
        detail: t("membersDetail", {
          count: o.voting_members ?? 0,
          n: formatNumber(o.voting_members ?? 0),
        }),
        label: t("members"),
        value: o.members,
      };

const verificationFigure = (
  o: Overview,
  t: T,
  locale: Locale
): FigureProps | null => {
  if (o.verification_pending === undefined) {
    return null;
  }
  const waiting = o.verification_pending > 0 && o.verification_oldest_at;
  return {
    action: waiting ? t("reviewRequests") : undefined,
    detail: waiting
      ? t("verificationDetail", {
          date: formatLongDate(o.verification_oldest_at ?? "", locale),
        })
      : t("verificationNone"),
    href: "/admin/members",
    label: t("verificationPending"),
    value: o.verification_pending,
  };
};

const eventsFigure = (
  o: Overview,
  t: T,
  locale: Locale
): FigureProps | null => {
  if (o.upcoming_rsvps === undefined) {
    return null;
  }
  const next = o.next_event;
  let detail = t("noUpcoming");
  if (next) {
    const values = {
      booked: formatNumber(next.booked),
      date: formatLongDate(next.starts_at, locale),
      title: localized(next, "title", locale),
    };
    detail = next.capacity
      ? t("nextEventCapped", {
          ...values,
          capacity: formatNumber(next.capacity),
        })
      : t("nextEvent", values);
  }
  return {
    action: t("openEvents"),
    detail,
    href: "/admin/events",
    label: t("upcomingRsvps"),
    value: o.upcoming_rsvps,
  };
};

const submissionsFigure = (
  o: Overview,
  t: T,
  locale: Locale
): FigureProps | null => {
  if (o.open_submissions === undefined) {
    return null;
  }
  const stages = o.submissions_by_status ?? {};
  const intake = (stages.received ?? 0) + (stages.intake_check ?? 0);
  const reading = (stages.in_review ?? 0) + (stages.third_read ?? 0);
  return {
    action: o.open_submissions ? t("openPipeline") : undefined,
    detail: o.open_submissions
      ? t("submissionsDetail", {
          intake: formatNumber(intake),
          oldest: o.intake_oldest_at
            ? formatLongDate(o.intake_oldest_at, locale)
            : "—",
          reading: formatNumber(reading),
          selection: formatNumber(stages.selection ?? 0),
        })
      : t("submissionsNone"),
    href: "/admin/pipeline",
    label: t("openSubmissions"),
    value: o.open_submissions,
  };
};

/** Each figure with the sentence that gives it context (permission-gated). */
const buildFigures = (o: Overview, t: T, locale: Locale) =>
  [
    membersFigure(o, t),
    verificationFigure(o, t, locale),
    eventsFigure(o, t, locale),
    submissionsFigure(o, t, locale),
  ].filter((figure): figure is FigureProps => figure !== null);

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
  const figures = buildFigures(o, t, locale);

  return (
    <div className="grid gap-8">
      <AdminHeading title={t("title")} />
      {figures.length === 0 && !o.campaigns ? (
        <p className="type-body text-text-secondary">{t("nothing")}</p>
      ) : null}
      {figures.length > 0 ? (
        <div className="grid grid-cols-2 gap-gap-tight sm:gap-gap xl:grid-cols-3">
          {figures.map((figure) => (
            <Figure key={figure.label} {...figure} />
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

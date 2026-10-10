"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import type { Locale } from "@repo/internationalization";
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { callApi } from "@/lib/api";
import { SectionSpinner } from "../../states";
import { type Column, DataTable, ErrorLine } from "../kit";

interface Status {
  configured: boolean;
  home: string | null;
  invite?: { email: string; name: string; roles: string[] }[];
  listsError?: string;
  remove?: { email: string; name: string }[];
  state: {
    at: string;
    counts: Record<string, number>;
    problems: string[];
  } | null;
}

type Invite = NonNullable<Status["invite"]>[number];
type Remove = NonNullable<Status["remove"]>[number];

const total = (counts: Record<string, number>, suffix: string) =>
  Object.entries(counts)
    .filter(([k]) => k.endsWith(suffix))
    .reduce((sum, [, n]) => sum + n, 0);

/**
 * Settings: the team's Notion workspace. Whether the connection is set up,
 * what the last sync did, and who to invite or remove (Notion's API cannot
 * do either, so a workspace owner does it from these lists).
 */
export const NotionWorkspace = () => {
  const t = useTranslations("nexus.admin.settings.notion");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const status = useQuery({
    queryFn: () => callApi<Status>(supabase, "/notion/status", {}),
    queryKey: ["admin", "notion-status"],
  });

  const inviteColumns: Column<Invite>[] = [
    { cell: (r) => r.name, header: t("columns.name"), key: "name" },
    { cell: (r) => r.email, header: t("columns.email"), key: "email" },
    {
      cell: (r) => r.roles.join(", "),
      header: t("columns.roles"),
      key: "roles",
    },
  ];
  const removeColumns: Column<Remove>[] = [
    { cell: (r) => r.name, header: t("columns.name"), key: "name" },
    { cell: (r) => r.email, header: t("columns.email"), key: "email" },
  ];

  const { data } = status;
  const state = data?.state;

  return (
    <SalCard>
      <h2 className="type-subheading">{t("title")}</h2>
      <p className="type-body">{t("lede")}</p>
      {status.isPending ? <SectionSpinner /> : null}
      <ErrorLine error={status.error} />
      {data && !data.configured ? (
        <p className="type-body font-bold">{t("notConfigured")}</p>
      ) : null}
      {data?.configured && state ? (
        <div className="grid gap-1">
          <p className="type-body">
            {t("lastSync", {
              date: formatLongDate(state.at, locale),
              time: formatClock(state.at, locale),
            })}
          </p>
          <p className="type-caption">
            {t("counts", {
              created: formatNumber(total(state.counts, ".created")),
              published: formatNumber(
                total(state.counts, ".published") +
                  total(state.counts, ".republished")
              ),
              refused: formatNumber(state.counts["publish.refused"] ?? 0),
              updated: formatNumber(total(state.counts, ".updated")),
            })}
          </p>
          {state.problems.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm underline underline-offset-4">
                {t("problems", { count: formatNumber(state.problems.length) })}
              </summary>
              <ul className="type-caption mt-2 grid gap-1" dir="ltr">
                {state.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {data?.configured && !state ? (
        <p className="type-body">{t("noSyncYet")}</p>
      ) : null}
      {data?.listsError ? (
        <p className="type-caption">{t("listsError")}</p>
      ) : null}
      {data?.invite ? (
        <section className="grid gap-2">
          <h3 className="font-bold">{t("inviteTitle")}</h3>
          <p className="type-caption">{t("inviteHint")}</p>
          <DataTable
            caption={t("inviteTitle")}
            columns={inviteColumns}
            empty={t("inviteEmpty")}
            rowKey={(r) => r.email}
            rows={data.invite}
          />
        </section>
      ) : null}
      {data?.remove ? (
        <section className="grid gap-2">
          <h3 className="font-bold">{t("removeTitle")}</h3>
          <p className="type-caption">{t("removeHint")}</p>
          <DataTable
            caption={t("removeTitle")}
            columns={removeColumns}
            empty={t("removeEmpty")}
            rowKey={(r) => r.email}
            rows={data.remove}
          />
        </section>
      ) : null}
      {data?.home ? (
        <a
          className="inline-flex items-center gap-1.5 justify-self-start underline underline-offset-4"
          href={data.home}
          rel="noopener"
          target="_blank"
        >
          {t("open")}
          <ExternalLink aria-label={tc("externalLink")} className="size-3.5" />
        </a>
      ) : null}
    </SalCard>
  );
};

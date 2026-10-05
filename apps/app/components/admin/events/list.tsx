"use client";

import { useAuth } from "@repo/auth/provider";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { Locale } from "@repo/internationalization";
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { localized, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorState, SectionSpinner } from "../../states";
import { AdminHeading, type Column, DataTable } from "../kit";
import { adminEventColumns, useProgrammeOptions } from "./data";

type Tab = "upcoming" | "past" | "drafts";

export const EventsList = () => {
  const t = useTranslations("nexus.admin.events");
  const ts = useTranslations("nexus.admin.kit.statuses");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const programmes = useProgrammeOptions();
  const [tab, setTab] = useState<Tab>("upcoming");

  const events = useQuery({
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase
        .schema("events")
        .from("events")
        .select(adminEventColumns);
      if (tab === "drafts") {
        query = query.eq("status", "draft").order("starts_at");
      } else if (tab === "upcoming") {
        query = query
          .neq("status", "draft")
          .gte("starts_at", now)
          .order("starts_at");
      } else {
        query = query
          .neq("status", "draft")
          .lt("starts_at", now)
          .order("starts_at", { ascending: false })
          .limit(100);
      }
      const rows = unwrap(await query) ?? [];
      const ids = rows.map((e) => e.id);
      const rsvps = ids.length
        ? (unwrap(
            await supabase
              .schema("events")
              .from("rsvps")
              .select("event_id")
              .eq("status", "confirmed")
              .in("event_id", ids)
          ) ?? [])
        : [];
      return rows.map((e) => ({
        ...e,
        confirmed: rsvps.filter((r) => r.event_id === e.id).length,
      }));
    },
    queryKey: ["admin", "events", tab],
  });

  type Row = NonNullable<typeof events.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (e) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/admin/events/edit", query: { id: e.id } }}
        >
          {localized(e, "title", locale)}
        </Link>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (e) => (
        <span className="whitespace-nowrap">
          {formatLongDate(e.starts_at, locale)},{" "}
          {formatClock(e.starts_at, locale)}
        </span>
      ),
      header: t("columns.when"),
      key: "when",
    },
    {
      cell: (e) => programmes.label(e.programme_id) ?? "—",
      header: t("columns.programme"),
      key: "programme",
    },
    {
      cell: (e) => (e.members_only ? t("membersOnly") : t("public")),
      header: t("columns.access"),
      key: "access",
    },
    {
      cell: (e) =>
        e.capacity
          ? t("rsvpCount", {
              capacity: formatNumber(e.capacity),
              confirmed: formatNumber(e.confirmed),
            })
          : formatNumber(e.confirmed),
      className: "tabular-nums whitespace-nowrap",
      header: t("columns.rsvps"),
      key: "rsvps",
    },
    {
      cell: (e) => ts(e.status as "draft" | "published" | "cancelled"),
      header: t("columns.status"),
      key: "status",
    },
    {
      cell: (e) =>
        e.status === "published" ? (
          <Link
            className="text-sm underline underline-offset-4"
            href={{ pathname: "/admin/events/check-in", query: { id: e.id } }}
          >
            {t("checkIn")}
          </Link>
        ) : null,
      header: "",
      key: "check-in",
    },
  ];

  return (
    <div className="grid gap-6">
      <AdminHeading
        actions={
          <Link
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-primary-foreground text-sm"
            href="/admin/events/edit"
          >
            {t("new")}
          </Link>
        }
        title={t("title")}
      >
        {t("lede")}
      </AdminHeading>
      <Tabs onValueChange={(v) => setTab(v as Tab)} value={tab}>
        <TabsList>
          <TabsTrigger value="upcoming">{t("tabs.upcoming")}</TabsTrigger>
          <TabsTrigger value="past">{t("tabs.past")}</TabsTrigger>
          <TabsTrigger value="drafts">{t("tabs.drafts")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {events.isPending ? <SectionSpinner /> : null}
      {events.isError ? <ErrorState onRetry={() => events.refetch()} /> : null}
      {events.data ? (
        <DataTable
          caption={t("title")}
          columns={columns}
          rowKey={(e) => e.id}
          rows={events.data}
        />
      ) : null}
      <p className="type-caption">{t("campusNote")}</p>
    </div>
  );
};

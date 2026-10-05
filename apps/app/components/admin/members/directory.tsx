"use client";

import { useAuth } from "@repo/auth/provider";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermission } from "@repo/rbac";
import { membership } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { useGrants } from "@/lib/queries";
import { ErrorState, SectionSpinner } from "../../states";
import {
  AdminHeading,
  type Column,
  DataTable,
  ExportButton,
  RowCount,
  SelectInput,
} from "../kit";

type Row = membership.DirectoryRow;

export const useDirectory = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: () => membership.directory(supabase),
    queryKey: ["admin", "directory"],
  });
};

export const memberName = (
  row: Pick<Row, "full_name_en" | "full_name_ar">,
  locale: string
) =>
  (locale === "ar" && row.full_name_ar) ||
  row.full_name_en ||
  row.full_name_ar ||
  "";

export const MembersDirectory = () => {
  const t = useTranslations("nexus.admin.members");
  const tt = useTranslations("nexus.home.tiers");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const id = useId();
  const grants = useGrants();
  const directory = useDirectory();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"" | membership.Tier>("");
  const [votingOnly, setVotingOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const deferred = useDeferredValue(query);

  const rows = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    return (directory.data ?? []).filter(
      (row) =>
        (!needle ||
          row.email.toLowerCase().includes(needle) ||
          row.full_name_en.toLowerCase().includes(needle) ||
          (row.full_name_ar ?? "").includes(deferred.trim())) &&
        (!tier || row.tier === tier) &&
        (!votingOnly || row.voting_member) &&
        !(unverifiedOnly && row.verified_at)
    );
  }, [deferred, directory.data, tier, unverifiedOnly, votingOnly]);

  if (directory.isPending) {
    return <SectionSpinner />;
  }
  if (directory.isError) {
    return <ErrorState onRetry={() => directory.refetch()} />;
  }

  const pending = directory.data.filter((row) => !row.verified_at).length;
  const columns: Column<Row>[] = [
    {
      cell: (row) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{
            pathname: "/admin/members/member",
            query: { id: row.user_id },
          }}
        >
          {memberName(row, locale) || t("unnamed")}
        </Link>
      ),
      header: t("columns.name"),
      key: "name",
    },
    {
      cell: (row) => (
        <span className="break-all" dir="ltr">
          {row.email}
        </span>
      ),
      header: t("columns.email"),
      key: "email",
    },
    {
      cell: (row) => (row.tier ? tt(row.tier) : "—"),
      header: t("columns.tier"),
      key: "tier",
    },
    {
      cell: (row) =>
        row.member_since ? formatLongDate(row.member_since, locale, true) : "—",
      className: "whitespace-nowrap",
      header: t("columns.since"),
      key: "since",
    },
    {
      cell: (row) => formatNumber(row.activities),
      className: "text-end tabular-nums",
      header: t("columns.activities"),
      key: "activities",
    },
    {
      cell: (row) => (row.voting_member ? t("yes") : t("no")),
      header: t("columns.voting"),
      key: "voting",
    },
    {
      cell: (row) => (row.verified_at ? t("verified") : t("unverified")),
      header: t("columns.status"),
      key: "status",
    },
  ];

  return (
    <div className="grid gap-6">
      <AdminHeading
        actions={
          <>
            {hasPermission(grants.data, "members.verify") ? (
              <Link
                className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                href="/admin/members/verification"
              >
                {t("queue", { count: formatNumber(pending) })}
              </Link>
            ) : null}
            <ExportButton fileName="sal-members.csv" name="members" />
          </>
        }
        title={t("title")}
      >
        {t("lede")}
      </AdminHeading>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-q`}>{tk("search")}</Label>
          <Input
            className="w-72 max-w-full"
            id={`${id}-q`}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tk("searchPlaceholder")}
            type="search"
            value={query}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-tier`}>{t("filters.tier")}</Label>
          <SelectInput
            className="w-44"
            id={`${id}-tier`}
            onChange={(e) => setTier(e.target.value as "" | membership.Tier)}
            value={tier}
          >
            <option value="">{tk("all")}</option>
            {membership.tiers.map((value) => (
              <option key={value} value={value}>
                {tt(value)}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            checked={votingOnly}
            id={`${id}-voting`}
            onCheckedChange={(v) => setVotingOnly(v === true)}
          />
          <Label htmlFor={`${id}-voting`}>{t("filters.voting")}</Label>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            checked={unverifiedOnly}
            id={`${id}-unverified`}
            onCheckedChange={(v) => setUnverifiedOnly(v === true)}
          />
          <Label htmlFor={`${id}-unverified`}>{t("filters.unverified")}</Label>
        </div>
      </div>
      <RowCount count={rows.length} />
      <DataTable
        caption={t("title")}
        columns={columns}
        empty={tk("noMatches")}
        rowKey={(row) => row.user_id}
        rows={rows}
      />
    </div>
  );
};

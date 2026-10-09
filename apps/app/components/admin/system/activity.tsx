"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import type { Locale } from "@repo/internationalization";
import {
  formatDateTime,
  formatNumber,
} from "@repo/internationalization/format";
import { unwrap } from "@repo/sal-data";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  type Column,
  DataTable,
  Field,
  SelectInput,
} from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const PAGE = 50;
const IGNORED_FIELDS = new Set(["updated_at", "search"]);

type Operation = "INSERT" | "UPDATE" | "DELETE";

/** The fields an UPDATE changed (timestamps and search vectors aside). */
export const changedFields = (
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null
) => {
  if (!(oldRow && newRow)) {
    return Object.keys(oldRow ?? newRow ?? {}).filter(
      (f) => !IGNORED_FIELDS.has(f)
    );
  }
  return Object.keys(newRow).filter(
    (field) =>
      !IGNORED_FIELDS.has(field) &&
      JSON.stringify(oldRow[field]) !== JSON.stringify(newRow[field])
  );
};

/** The tables with activity-log triggers (migrations: `log_activity`). */
const LOGGED_TABLES = [
  "access.role_assignments",
  "access.role_permissions",
  "charity.campaigns",
  "charity.impact_metrics",
  "charity.ledger_entries",
  "charity.ledger_signoffs",
  "charity.receipts",
  "content.announcements",
  "content.homepage_slots",
  "content.news_posts",
  "content.pages",
  "core.semesters",
  "core.settings",
  "events.check_ins",
  "events.events",
  "governance.candidates",
  "governance.election_results",
  "governance.elections",
  "governance.handbook_pages",
  "governance.library_documents",
  "governance.member_offers",
  "governance.minutes",
  "governance.partner_affiliations",
  "governance.partner_agreements",
  "governance.partners",
  "governance.resolutions",
  "governance.spending_approvals",
  "journal.agreements",
  "journal.call_partners",
  "journal.calls",
  "journal.decisions",
  "journal.issues",
  "journal.pieces",
  "membership.activity_records",
  "membership.certificates",
  "membership.memberships",
  "membership.service_records",
  "membership.verification_requests",
  "programmes.episodes",
  "programmes.reels",
  "programmes.removal_requests",
  "programmes.six_words",
] as const;

const operationClass: Record<Operation, string> = {
  DELETE: "font-bold text-title",
  INSERT: "font-bold text-text",
  UPDATE: "text-text-secondary",
};

export const ActivityLog = () => {
  const t = useTranslations("nexus.admin.activity");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const [table, setTable] = useState("");
  const [operation, setOperation] = useState<"" | Operation>("");

  const log = useInfiniteQuery({
    getNextPageParam: (last: { id: number }[]) =>
      last.length === PAGE ? (last.at(-1)?.id ?? null) : null,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .schema("core")
        .from("activity_log")
        .select(
          "id, table_schema, table_name, operation, row_id, actor_id, old_row, new_row, occurred_at"
        )
        .order("id", { ascending: false })
        .limit(PAGE);
      if (pageParam) {
        query = query.lt("id", pageParam);
      }
      if (table) {
        const [schema, name] = table.split(".");
        query = query
          .eq("table_schema", schema ?? "")
          .eq("table_name", name ?? "");
      }
      if (operation) {
        query = query.eq("operation", operation);
      }
      return unwrap(await query) ?? [];
    },
    queryKey: ["admin", "activity-log", table, operation],
  });

  const rows = log.data?.pages.flat() ?? [];
  const names = useMemberNames(rows.map((r) => r.actor_id));
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    {
      cell: (r) => formatDateTime(r.occurred_at, locale),
      className: "whitespace-nowrap",
      header: t("when"),
      key: "when",
    },
    {
      cell: (r) => (
        <span className={operationClass[r.operation as Operation]}>
          {t(`operations.${r.operation as Operation}`)}
        </span>
      ),
      header: t("operation"),
      key: "operation",
    },
    {
      cell: (r) => (
        <span className="type-code" dir="ltr">
          {r.table_schema}.{r.table_name}
        </span>
      ),
      header: t("table"),
      key: "table",
    },
    {
      cell: (r) => {
        const person = names.data?.find((n) => n.id === r.actor_id);
        return person ? memberName(person, locale) : t("system");
      },
      header: t("actor"),
      key: "actor",
    },
    {
      cell: (r) => {
        const fields = changedFields(
          r.old_row as Record<string, unknown> | null,
          r.new_row as Record<string, unknown> | null
        );
        return r.operation === "UPDATE" ? (
          <span className="type-code text-xs" dir="ltr">
            {fields.join(", ")}
          </span>
        ) : (
          <span className="type-caption">
            {t("fields", {
              count: fields.length,
              countText: formatNumber(fields.length),
            })}
          </span>
        );
      },
      header: t("changes"),
      key: "changes",
    },
  ];

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <div className="flex flex-wrap gap-4">
        <Field label={t("table")}>
          {(id) => (
            <SelectInput
              className="w-72"
              id={id}
              onChange={(e) => setTable(e.target.value)}
              value={table}
            >
              <option value="">{t("allTables")}</option>
              {LOGGED_TABLES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("operation")}>
          {(id) => (
            <SelectInput
              className="w-44"
              id={id}
              onChange={(e) => setOperation(e.target.value as "" | Operation)}
              value={operation}
            >
              <option value="">{t("allChanges")}</option>
              {(["INSERT", "UPDATE", "DELETE"] as const).map((op) => (
                <option key={op} value={op}>
                  {t(`operations.${op}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>
      {log.isPending ? (
        <SectionSpinner />
      ) : (
        <DataTable columns={columns} rowKey={(r) => String(r.id)} rows={rows} />
      )}
      {log.hasNextPage ? (
        <Button
          className={cn("justify-self-start")}
          disabled={log.isFetchingNextPage}
          onClick={() => log.fetchNextPage()}
          variant="outline"
        >
          {t("more")}
        </Button>
      ) : null}
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { Locale } from "@repo/internationalization";
import { formatNumber } from "@repo/internationalization/format";
import { localized, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
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
import { Board, Decided, Selection } from "./board";
import { Calls } from "./calls";
import {
  type Category,
  type PipelineIssue,
  pipelineKey,
  type SubmissionStatus,
  useBlindEntries,
  usePipelineIssues,
} from "./data";
import { EntryLink } from "./entry-link";
import { IntakeQueue, Readers } from "./intake";

/** The reader's own assignments for the issue, with their score if sent. */
const MyReads = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const ts = useTranslations("nexus.journal.status");
  const { supabase, user } = useAuth();
  const reads = useQuery({
    enabled: Boolean(user),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("assignments")
          .select(
            "id, read_number, entry:blind_entries!inner(id, blind_id, title, category, status, issue_id), score:scores(total)"
          )
          .eq("reader_id", user?.id ?? "")
          .eq("entry.issue_id", issueId)
          .order("assigned_at")
      ) ?? [],
    queryKey: [...pipelineKey, "reads", issueId, user?.id],
  });
  type Row = NonNullable<typeof reads.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (r) => <span className="type-code">{r.entry.blind_id}</span>,
      header: t("columns.blindId"),
      key: "blind",
    },
    {
      cell: (r) => <EntryLink id={r.entry.id} label={r.entry.title} />,
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (r) => tj(`categories.${r.entry.category as Category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (r) => t("readNumber", { number: formatNumber(r.read_number) }),
      header: t("columns.read"),
      key: "read",
    },
    {
      cell: (r) =>
        typeof r.score?.total === "number"
          ? t("scored", { total: formatNumber(r.score.total) })
          : ts(r.entry.status as SubmissionStatus),
      header: t("columns.yourScore"),
      key: "score",
    },
  ];
  return reads.data ? (
    <div className="grid gap-3">
      <p className="type-caption">{t("reading.note")}</p>
      <DataTable
        columns={columns}
        empty={t("reading.empty")}
        rowKey={(r) => r.id}
        rows={reads.data}
      />
    </div>
  ) : (
    <SectionSpinner />
  );
};

/** Advisory Board: flagged pieces only (RLS returns nothing else). */
const Flagged = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const entries = useBlindEntries(issueId);
  const flagged = entries.data?.filter((e) => e.flagged) ?? [];
  type Row = (typeof flagged)[number];
  const columns: Column<Row>[] = [
    {
      cell: (e) => <span className="type-code">{e.blind_id}</span>,
      header: t("columns.blindId"),
      key: "blind",
    },
    {
      cell: (e) => <EntryLink id={e.id} label={e.title} />,
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (e) => tj(`categories.${e.category as Category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (e) => e.flag_note ?? "—",
      header: t("columns.flagNote"),
      key: "note",
    },
  ];
  return entries.data ? (
    <DataTable
      columns={columns}
      empty={t("flagged.empty")}
      rowKey={(e) => e.id}
      rows={flagged}
    />
  ) : (
    <SectionSpinner />
  );
};

type TabKey =
  | "reading"
  | "intake"
  | "readers"
  | "board"
  | "selection"
  | "decided"
  | "flagged"
  | "calls";

const tabsFor = (issue: PipelineIssue): TabKey[] => {
  const editor = issue.can_manage || issue.can_decide;
  const tabs: [TabKey, boolean][] = [
    ["reading", issue.can_review],
    ["intake", issue.can_identity],
    ["readers", issue.can_identity],
    ["board", editor],
    ["selection", editor],
    ["decided", editor || issue.can_identity],
    ["flagged", issue.can_advise],
    ["calls", issue.can_manage],
  ];
  return tabs.filter(([, shown]) => shown).map(([key]) => key);
};

const TabBody = ({ issue, tab }: { issue: PipelineIssue; tab: TabKey }) => {
  switch (tab) {
    case "reading":
      return <MyReads issueId={issue.id} />;
    case "intake":
      return <IntakeQueue issueId={issue.id} />;
    case "readers":
      return <Readers issueId={issue.id} />;
    case "board":
      return <Board issueId={issue.id} />;
    case "selection":
      return <Selection canDecide={issue.can_decide} issueId={issue.id} />;
    case "decided":
      return <Decided issueId={issue.id} />;
    case "flagged":
      return <Flagged issueId={issue.id} />;
    default:
      return <Calls issueId={issue.id} />;
  }
};

export const PipelineAdmin = () => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const locale = useLocale() as Locale;
  const issues = usePipelineIssues();
  const [chosen, setChosen] = useState("");
  const issue =
    issues.data?.find((i) => i.id === chosen) ?? issues.data?.[0] ?? null;
  const tabs = issue ? tabsFor(issue) : [];

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      {issues.data ? null : <SectionSpinner />}
      {issues.data && !issue ? <p>{t("noIssues")}</p> : null}
      {issue ? (
        <>
          <Field label={tj("columns.issue")}>
            {(id) => (
              <SelectInput
                className="w-80"
                id={id}
                onChange={(e) => setChosen(e.target.value)}
                value={issue.id}
              >
                {issues.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {tj("volumeNumber", {
                      number: formatNumber(i.number),
                      volume: formatNumber(i.volume),
                    })}{" "}
                    · {localized(i, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Tabs defaultValue={tabs[0]} key={issue.id}>
            <TabsList className="flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {t(`tabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent className="pt-4" key={tab} value={tab}>
                <TabBody issue={issue} tab={tab} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      ) : null}
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
import { cn } from "@repo/design-system/lib/utils";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { journal, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type DragEvent, useState } from "react";
import { SectionSpinner } from "../../states";
import { type Column, DataTable, ErrorLine, SelectInput } from "../kit";
import {
  type BlindEntryRow,
  type Category,
  entryAverage,
  pipelineKey,
  readTotals,
  type SubmissionStatus,
  useBlindEntries,
} from "./data";
import { EntryLink } from "./entry-link";

const COLUMNS = ["in_review", "third_read", "selection"] as const;
const DRAG_TYPE = "application/x-sal-entry";

const useScoreText = () => {
  const t = useTranslations("nexus.admin.pipeline");
  return (entry: BlindEntryRow) => {
    const totals = readTotals(entry);
    const average = entryAverage(entry);
    const reads = totals
      .map((total) => (total === null ? "—" : formatNumber(total)))
      .join(" / ");
    if (average === null) {
      return t("noScores");
    }
    return t("scoreLine", {
      average: formatNumber(average),
      band: t(`bands.${journal.band(average)}`),
      reads,
    });
  };
};

const Card = ({
  entry,
  onMove,
  pending,
}: {
  entry: BlindEntryRow;
  onMove: (to: SubmissionStatus) => void;
  pending: boolean;
}) => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const ts = useTranslations("nexus.waraq.status");
  const scoreText = useScoreText();
  const moves = journal.editorMoves[entry.status] ?? [];
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag source; the Move menu is the keyboard path
    <li
      className="grid cursor-grab gap-2 rounded-card bg-surface p-3"
      draggable={moves.length > 0}
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData(
          DRAG_TYPE,
          JSON.stringify({ from: entry.status, id: entry.id })
        );
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="type-code">{entry.blind_id}</span>
        {entry.flagged ? (
          <span className="type-caption">{t("flaggedMark")}</span>
        ) : null}
      </div>
      <EntryLink id={entry.id} label={entry.title} />
      <p className="type-caption">
        {tj(`categories.${entry.category as Category}`)} · {scoreText(entry)}
      </p>
      {moves.length > 0 ? (
        <SelectInput
          aria-label={t("board.moveLabel", { id: entry.blind_id })}
          disabled={pending}
          onChange={(e) => {
            if (e.target.value) {
              onMove(e.target.value as SubmissionStatus);
            }
          }}
          value=""
        >
          <option value="">{t("board.moveTo")}</option>
          {moves.map((to) => (
            <option key={to} value={to}>
              {ts(to)}
            </option>
          ))}
        </SelectInput>
      ) : null}
    </li>
  );
};

/** Editors: drag a card (or use its Move menu) to move it on. */
export const Board = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const ts = useTranslations("nexus.waraq.status");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const entries = useBlindEntries(issueId);
  const [over, setOver] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: SubmissionStatus }) =>
      journal.transition(supabase, id, to),
    onSettled: () => queryClient.invalidateQueries({ queryKey: pipelineKey }),
  });

  if (!entries.data) {
    return <SectionSpinner />;
  }
  const decided = entries.data.filter((e) =>
    journal.finalStatuses.some((s) => s === e.status)
  );

  const drop = (to: SubmissionStatus) => (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    try {
      const card = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as {
        from: SubmissionStatus;
        id: string;
      };
      if (journal.canEditorMove(card.from, to)) {
        move.mutate({ id: card.id, to });
      }
    } catch {
      // Not one of our cards.
    }
  };

  return (
    <div className="grid gap-4">
      <p className="type-caption">{t("board.note")}</p>
      <ErrorLine error={move.error} />
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((status) => {
          const cards = entries.data.filter((e) => e.status === status);
          return (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop target; the Move menu is the keyboard path
            <section
              aria-label={ts(status)}
              className={cn(
                "grid content-start gap-3 rounded-card bg-surface-tint p-3",
                over === status && "outline-2 outline-accent-line"
              )}
              key={status}
              onDragLeave={() => setOver(null)}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes(DRAG_TYPE)) {
                  event.preventDefault();
                  setOver(status);
                }
              }}
              onDrop={drop(status)}
            >
              <h3 className="font-medium">
                {ts(status)} ({formatNumber(cards.length)})
              </h3>
              <ul className="grid gap-2">
                {cards.map((entry) => (
                  <Card
                    entry={entry}
                    key={entry.id}
                    onMove={(to) => move.mutate({ id: entry.id, to })}
                    pending={move.isPending}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        <section className="grid content-start gap-3 rounded-card bg-surface-tint p-3">
          <h3 className="font-medium">
            {t("board.decided")} ({formatNumber(decided.length)})
          </h3>
          <ul className="grid gap-2">
            {decided.map((entry) => (
              <li
                className="grid gap-1 rounded-card bg-surface p-3"
                key={entry.id}
              >
                <span className="type-code">{entry.blind_id}</span>
                <EntryLink id={entry.id} label={entry.title} />
                <span className="type-caption">{ts(entry.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

/** Pieces in selection, strongest first. Decisions are made on the entry. */
export const Selection = ({
  canDecide,
  issueId,
}: {
  canDecide: boolean;
  issueId: string;
}) => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const entries = useBlindEntries(issueId);
  const scoreText = useScoreText();
  if (!entries.data) {
    return <SectionSpinner />;
  }
  const rows = entries.data
    .filter((e) => e.status === "selection")
    .map((e) => ({ average: entryAverage(e), entry: e }))
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  type Row = (typeof rows)[number];
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
      cell: (r) => scoreText(r.entry),
      header: t("columns.scores"),
      key: "scores",
    },
  ];
  return (
    <div className="grid gap-3">
      <p className="type-caption">
        {canDecide ? t("selection.note") : t("selection.viewOnly")}
      </p>
      <DataTable
        columns={columns}
        empty={t("selection.empty")}
        rowKey={(r) => r.entry.id}
        rows={rows}
      />
    </div>
  );
};

/** The author, revealed to the review team once a decision exists. */
export const AuthorName = ({ entryId }: { entryId: string }) => {
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const author = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .rpc("entry_author", { blind_entry_id: entryId })
      )?.[0] ?? null,
    queryKey: [...pipelineKey, "author", entryId],
  });
  return author.data ? localized(author.data, "author_name", locale) : "—";
};

export const Decided = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const decisions = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("decisions")
          .select(
            "id, decision, decided_at, entry:blind_entries!inner(id, blind_id, title, issue_id)"
          )
          .eq("entry.issue_id", issueId)
          .order("decided_at", { ascending: false })
      ) ?? [],
    queryKey: [...pipelineKey, "decisions", issueId],
  });
  type Row = NonNullable<typeof decisions.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (d) => <span className="type-code">{d.entry.blind_id}</span>,
      header: t("columns.blindId"),
      key: "blind",
    },
    {
      cell: (d) => <EntryLink id={d.entry.id} label={d.entry.title} />,
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (d) =>
        t(
          `decisions.${d.decision as "accept" | "accept_with_edits" | "decline"}`
        ),
      header: t("columns.decision"),
      key: "decision",
    },
    {
      cell: (d) => <AuthorName entryId={d.entry.id} />,
      header: t("columns.author"),
      key: "author",
    },
    {
      cell: (d) => formatLongDate(d.decided_at, locale, true),
      className: "whitespace-nowrap",
      header: t("columns.decided"),
      key: "decided",
    },
  ];
  return decisions.data ? (
    <div className="grid gap-3">
      <p className="type-caption">{t("decided.note")}</p>
      <DataTable
        columns={columns}
        empty={t("decided.empty")}
        rowKey={(d) => d.id}
        rows={decisions.data}
      />
    </div>
  ) : (
    <SectionSpinner />
  );
};

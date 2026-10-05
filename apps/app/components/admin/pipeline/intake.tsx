"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  type Column,
  ConfirmAction,
  DataTable,
  ErrorLine,
  Field,
  SelectInput,
} from "../kit";
import {
  type Category,
  openSubmissionFile,
  pipelineKey,
  type SubmissionStatus,
  useBlindEntries,
} from "./data";
import { TextView } from "./text-view";

const INTAKE: SubmissionStatus[] = ["received", "intake_check"];

const useIntakeQueue = (issueId: string | null) => {
  const { supabase } = useAuth();
  return useQuery({
    enabled: Boolean(issueId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .rpc("intake_queue", { issue_id: issueId ?? "" })
      ) ?? [],
    queryKey: [...pipelineKey, "intake", issueId],
  });
};

/** Submissions Manager: every submission to the issue, with its author. */
export const IntakeQueue = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const ts = useTranslations("nexus.waraq.status");
  const locale = useLocale() as Locale;
  const queue = useIntakeQueue(issueId);
  const [scope, setScope] = useState<"intake" | "all">("intake");
  const rows =
    queue.data?.filter((s) => scope === "all" || INTAKE.includes(s.status)) ??
    [];
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      cell: (s) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{
            pathname: "/admin/pipeline/submission",
            query: { id: s.submission_id },
          }}
        >
          {s.title}
        </Link>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (s) => localized(s, "author_name", locale) || "—",
      header: t("columns.author"),
      key: "author",
    },
    {
      cell: (s) => tj(`categories.${s.category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (s) =>
        s.intake_returned_at && s.status === "intake_check"
          ? t("intake.returned")
          : ts(s.status),
      header: t("columns.status"),
      key: "status",
    },
    {
      cell: (s) => formatNumber(s.file_count),
      header: t("columns.files"),
      key: "files",
    },
    {
      cell: (s) => formatLongDate(s.created_at, locale, true),
      className: "whitespace-nowrap",
      header: t("columns.received"),
      key: "received",
    },
  ];
  return queue.data ? (
    <div className="grid gap-4">
      <p className="type-caption">{t("intake.note")}</p>
      <Field label={t("intake.show")}>
        {(id) => (
          <SelectInput
            className="w-60"
            id={id}
            onChange={(e) => setScope(e.target.value as "intake" | "all")}
            value={scope}
          >
            <option value="intake">{t("intake.inIntake")}</option>
            <option value="all">{t("intake.all")}</option>
          </SelectInput>
        )}
      </Field>
      <DataTable
        columns={columns}
        empty={t("intake.empty")}
        rowKey={(s) => s.submission_id}
        rows={rows}
      />
    </div>
  ) : (
    <SectionSpinner />
  );
};

// ── Reader assignments ──────────────────────────────────────────────────────

const AssignSlot = ({
  entryId,
  existing,
  issueId,
  readNumber,
  team,
}: {
  entryId: string;
  existing: { id: string; reader_id: string } | undefined;
  issueId: string;
  readNumber: number;
  team: {
    full_name_ar: string | null;
    full_name_en: string;
    user_id: string;
  }[];
}) => {
  const t = useTranslations("nexus.admin.pipeline");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [reader, setReader] = useState("");
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [...pipelineKey, "entries", issueId],
    });
  const assign = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("journal").rpc("assign_reader", {
          blind_entry_id: entryId,
          read_number: readNumber,
          reader_id: reader,
        })
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("journal")
          .from("assignments")
          .delete()
          .eq("id", id)
      ),
    onSuccess: refresh,
  });
  const nameOf = (id: string) => {
    const person = team.find((m) => m.user_id === id);
    return person ? localized(person, "full_name", locale) : t("formerReader");
  };

  if (existing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span>{nameOf(existing.reader_id)}</span>
        <ConfirmAction
          confirmLabel={t("readers.unassign")}
          description={t("readers.unassignConfirm")}
          disabled={remove.isPending}
          onConfirm={() => remove.mutate(existing.id)}
          variant="ghost"
        >
          {t("readers.unassign")}
        </ConfirmAction>
        <ErrorLine error={remove.error} />
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          aria-label={t("readNumber", { number: formatNumber(readNumber) })}
          className="w-52"
          onChange={(e) => setReader(e.target.value)}
          value={reader}
        >
          <option value="">{t("readers.choose")}</option>
          {team.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {localized(m, "full_name", locale)}
            </option>
          ))}
        </SelectInput>
        <Button
          disabled={!reader || assign.isPending}
          onClick={() => assign.mutate()}
          size="sm"
        >
          {t("readers.assign")}
        </Button>
      </div>
      <ErrorLine error={assign.error} />
    </div>
  );
};

/** Submissions Manager: two blind reads per entry, a third when flagged. */
export const Readers = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline");
  const ts = useTranslations("nexus.waraq.status");
  const { supabase } = useAuth();
  const entries = useBlindEntries(issueId);
  const team = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .rpc("review_team", { issue_id: issueId })
      ) ?? [],
    queryKey: [...pipelineKey, "team", issueId],
  });
  const open =
    entries.data?.filter(
      (e) => e.status === "in_review" || e.status === "third_read"
    ) ?? [];
  if (!(entries.data && team.data)) {
    return <SectionSpinner />;
  }
  const people = team.data.map((m) => ({
    ...m,
    full_name_en: m.full_name_en ?? "",
  }));
  return (
    <div className="grid gap-4">
      <p className="type-caption">{t("readers.note")}</p>
      {team.data.length === 0 ? <p>{t("readers.noTeam")}</p> : null}
      {open.length === 0 ? <p>{t("readers.empty")}</p> : null}
      <ul className="grid gap-3">
        {open.map((entry) => {
          const reads = entry.status === "third_read" ? [1, 2, 3] : [1, 2];
          return (
            <li
              className="grid gap-3 rounded-card bg-surface-tint p-4"
              key={entry.id}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="type-code">{entry.blind_id}</span>
                <span className="font-medium">{entry.title}</span>
                <span className="type-caption">{ts(entry.status)}</span>
              </div>
              <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
                {reads.map((n) => (
                  <div className="contents" key={n}>
                    <dt className="font-medium text-sm">
                      {t("readNumber", { number: formatNumber(n) })}
                    </dt>
                    <dd>
                      <AssignSlot
                        entryId={entry.id}
                        existing={entry.assignments.find(
                          (a) => a.read_number === n
                        )}
                        issueId={issueId}
                        readNumber={n}
                        team={people}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ── One submission (Submissions Manager) ────────────────────────────────────

export const SubmissionView = () => {
  const t = useTranslations("nexus.admin.pipeline");
  const tj = useTranslations("nexus.admin.journal");
  const ts = useTranslations("nexus.waraq.status");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const id = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const submission = useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const [row, files, history] = await Promise.all([
        supabase
          .schema("journal")
          .from("submissions")
          .select("*, call:calls(issue_id)")
          .eq("id", id ?? "")
          .maybeSingle(),
        supabase
          .schema("journal")
          .from("submission_files")
          .select("id, kind, mime_type, size_bytes, created_at")
          .eq("submission_id", id ?? "")
          .order("created_at"),
        supabase
          .schema("journal")
          .from("status_history")
          .select("id, from_status, to_status, note, changed_at")
          .eq("submission_id", id ?? "")
          .order("changed_at"),
      ]);
      return {
        files: unwrap(files) ?? [],
        history: unwrap(history) ?? [],
        row: unwrap(row),
      };
    },
    queryKey: [...pipelineKey, "submission", id],
  });
  const row = submission.data?.row;
  const queue = useIntakeQueue(row?.call?.issue_id ?? null);
  const author = queue.data?.find((s) => s.submission_id === id);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: pipelineKey });
  const move = useMutation({
    mutationFn: (to: SubmissionStatus) =>
      journal.transition(supabase, id ?? "", to),
    onSuccess: refresh,
  });
  const returnIt = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("journal").rpc("return_for_formatting", {
          note,
          submission_id: id ?? "",
        })
      ),
    onSuccess: async () => {
      setNote("");
      await refresh();
    },
  });
  const openFile = useMutation({
    mutationFn: (fileId: string) => openSubmissionFile(supabase, fileId),
  });

  if (submission.isPending && id) {
    return <SectionSpinner />;
  }
  const back = (
    <Link
      className="text-sm underline underline-offset-4"
      href="/admin/pipeline"
    >
      {tk("back")}
    </Link>
  );
  if (!row) {
    return (
      <div className="grid gap-4">
        <AdminHeading actions={back} title={t("submission.title")} />
        <p>{t("submission.notFound")}</p>
      </div>
    );
  }
  const inIntake = INTAKE.includes(row.status);
  const open = !journal.finalStatuses.some((s) => s === row.status);

  return (
    <div className="grid gap-8">
      <AdminHeading actions={back} title={row.title}>
        {[
          author ? localized(author, "author_name", locale) : null,
          tj(`categories.${row.category as Category}`),
          tj(`languages.${row.language}`),
          ts(row.status),
        ]
          .filter(Boolean)
          .join(" · ")}
      </AdminHeading>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("submission.actions")}</h2>
        <p className="type-caption">{t("submission.intakeNote")}</p>
        <div className="flex flex-wrap gap-2">
          {row.status === "received" ? (
            <Button
              disabled={move.isPending}
              onClick={() => move.mutate("intake_check")}
              size="sm"
            >
              {t("submission.startCheck")}
            </Button>
          ) : null}
          {row.status === "intake_check" ? (
            <ConfirmAction
              confirmLabel={t("submission.toReview")}
              description={t("submission.toReviewConfirm")}
              disabled={move.isPending}
              onConfirm={() => move.mutate("in_review")}
              variant="default"
            >
              {t("submission.toReview")}
            </ConfirmAction>
          ) : null}
          {open ? (
            <ConfirmAction
              confirmLabel={t("submission.withdraw")}
              description={t("submission.withdrawConfirm")}
              disabled={move.isPending}
              onConfirm={() => move.mutate("withdrawn")}
            >
              {t("submission.withdraw")}
            </ConfirmAction>
          ) : null}
        </div>
        <ErrorLine error={move.error} />
        {row.intake_returned_at ? (
          <p className="text-sm">
            {t("submission.returnedOn", {
              date: formatLongDate(row.intake_returned_at, locale, true),
            })}{" "}
            {row.intake_note}
          </p>
        ) : null}
        {inIntake ? (
          <form
            className="grid max-w-2xl gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              returnIt.mutate();
            }}
          >
            <Field
              hint={t("submission.returnHint")}
              label={t("submission.returnNote")}
            >
              {(fieldId) => (
                <Textarea
                  id={fieldId}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  value={note}
                />
              )}
            </Field>
            <Button
              className="justify-self-start"
              disabled={!note.trim() || returnIt.isPending}
              size="sm"
              type="submit"
              variant="outline"
            >
              {t("submission.return")}
            </Button>
            <ErrorLine error={returnIt.error} />
          </form>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("submission.files")}</h2>
        {submission.data?.files.length ? (
          <ul className="grid gap-2">
            {submission.data.files.map((f, index) => (
              <li className="flex flex-wrap items-center gap-3" key={f.id}>
                <span>
                  {t(
                    `fileKinds.${f.kind as "manuscript" | "image" | "source"}`
                  )}{" "}
                  {formatNumber(index + 1)}
                </span>
                <Button
                  disabled={openFile.isPending}
                  onClick={() => openFile.mutate(f.id)}
                  size="sm"
                  variant="outline"
                >
                  {tk("open")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-caption">{t("submission.noFiles")}</p>
        )}
        <ErrorLine error={openFile.error} />
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("submission.text")}</h2>
        <TextView
          html={row.body_html}
          lang={row.language === "ar" ? "ar" : undefined}
        />
        {row.category === "translation" ? (
          <>
            <h3 className="font-medium">{t("submission.source")}</h3>
            <p className="whitespace-pre-wrap">{row.source_text}</p>
            <p className="type-caption">
              {row.source_author} · {row.rights_note}
            </p>
          </>
        ) : null}
        {row.cover_note ? (
          <>
            <h3 className="font-medium">{t("submission.coverNote")}</h3>
            <p className="whitespace-pre-wrap">{row.cover_note}</p>
          </>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("submission.history")}</h2>
        <ol className="grid gap-1 text-sm">
          {submission.data?.history.map((h) => (
            <li key={h.id}>
              {formatLongDate(h.changed_at, locale, true)}: {ts(h.to_status)}
              {h.note ? ` (${h.note})` : ""}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

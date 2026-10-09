"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { journal, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import {
  queryKeys,
  useMemberStatus,
  useMySubmissions,
  useOpenCalls,
} from "@/lib/queries";
import { useQueryParam } from "@/lib/use-query-param";
import {
  AdminHeading,
  type Column,
  ConfirmAction,
  DataTable,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../admin/kit";
import { SectionSpinner } from "../states";
import {
  attachFile,
  detachFile,
  FilePicker,
  kindsFor,
  type PendingFile,
  PendingList,
} from "./files";
import {
  AuthorshipPledge,
  blankWork,
  revisableColumns,
  WorkFields,
  type WorkValue,
  workIsReady,
} from "./form";

const buttonLink =
  "inline-flex h-9 items-center justify-self-start rounded-md bg-primary px-4 text-primary-foreground text-sm";
const FINAL: journal.SubmissionStatus[] = ["accepted", "declined", "withdrawn"];

const useInvalidate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.submissions(user?.id ?? ""),
    });
};

// ── Journal home ──────────────────────────────────────────────────────────────

export const JournalHome = () => {
  const t = useTranslations("nexus.journal");
  const tw = useTranslations("nexus.home.journal");
  const tj = useTranslations("nexus.admin.journal");
  const locale = useLocale() as Locale;
  const calls = useOpenCalls();
  const submissions = useMySubmissions();
  type Row = NonNullable<typeof submissions.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (s) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/journal/submission", query: { id: s.id } }}
        >
          {s.title}
        </Link>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (s) => tj(`categories.${s.category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (s) =>
        s.status === "intake_check" && s.intake_returned_at
          ? t("returned")
          : t(`status.${s.status}`),
      header: t("columns.status"),
      key: "status",
    },
    {
      cell: (s) => formatLongDate(s.created_at, locale),
      className: "whitespace-nowrap",
      header: t("columns.sent"),
      key: "sent",
    },
  ];

  return (
    <div className="grid gap-8">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <section className="grid gap-4">
        <h2 className="type-subheading">{t("openCalls")}</h2>
        {calls.data ? null : <SectionSpinner />}
        {calls.data?.length === 0 ? <p>{tw("none")}</p> : null}
        <ul className="grid gap-4">
          {calls.data?.map((call) => (
            <li
              className="grid gap-2 rounded-card bg-surface-tint p-4"
              key={call.id}
            >
              <h3 className="font-medium">
                {localized(call, "title", locale)}
              </h3>
              {localized(call, "theme", locale) ? (
                <p>{localized(call, "theme", locale)}</p>
              ) : null}
              {localized(call, "eligibility", locale) ? (
                <p className="type-caption whitespace-pre-wrap">
                  {localized(call, "eligibility", locale)}
                </p>
              ) : null}
              <p className="type-caption">
                {t("closes", {
                  date: formatLongDate(call.closes_at, locale, true),
                  max: formatNumber(call.max_per_person),
                })}
              </p>
              <Link
                className={buttonLink}
                href={{ pathname: "/journal/submit", query: { call: call.id } }}
              >
                {tw("submit")}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-4">
        <h2 className="type-subheading">{tw("mine")}</h2>
        {submissions.data ? (
          <DataTable
            columns={columns}
            empty={t("noSubmissions")}
            rowKey={(s) => s.id}
            rows={submissions.data}
          />
        ) : (
          <SectionSpinner />
        )}
      </section>
    </div>
  );
};

// ── Submit ──────────────────────────────────────────────────────────────────

type OpenCall = NonNullable<ReturnType<typeof useOpenCalls>["data"]>[number];
type Pathway = Awaited<ReturnType<typeof journal.myCallPathways>>[number];

/**
 * The partner pathway: Society members answer any open call; people
 * verified as a partner's members answer only the calls opened to that
 * partner, and always through it.
 */
const useSubmitPathway = (
  calls: OpenCall[] | null | undefined,
  callId: string,
  partnerId: string
) => {
  const { supabase } = useAuth();
  const status = useMemberStatus();
  const pathways = useQuery({
    queryFn: () => journal.myCallPathways(supabase),
    queryKey: ["journal", "pathways"],
  });
  const isMember = Boolean(status.data?.is_member);
  const callable = (calls ?? []).filter(
    (c) => isMember || pathways.data?.some((p) => p.call_id === c.id)
  );
  const call = callable.find((c) => c.id === callId) ?? callable[0];
  const callPathways = (pathways.data ?? []).filter(
    (p) => p.call_id === call?.id
  );
  const chosen = callPathways.find((p) => p.partner_id === partnerId);
  const throughPartner = isMember
    ? chosen?.partner_id
    : (chosen ?? callPathways[0])?.partner_id;
  return {
    call,
    callable,
    callPathways,
    isMember,
    pending: pathways.isPending || status.isPending,
    throughPartner,
  };
};

const PartnerPathway = ({
  isMember,
  onChange,
  pathways,
  value,
}: {
  isMember: boolean;
  onChange: (partnerId: string) => void;
  pathways: Pathway[];
  value: string | undefined;
}) => {
  const t = useTranslations("nexus.journal");
  const locale = useLocale();
  if (pathways.length === 0) {
    return null;
  }
  return (
    <Field
      hint={isMember ? t("throughPartnerOptional") : t("throughPartnerHint")}
      label={t("throughPartner")}
    >
      {(id) => (
        <SelectInput
          id={id}
          onChange={(e) => onChange(e.target.value)}
          value={value ?? ""}
        >
          {isMember ? <option value="">{t("asMember")}</option> : null}
          {pathways.map((p) => (
            <option key={p.partner_id} value={p.partner_id}>
              {localized(p, "name", locale)}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );
};

export const SubmitWork = () => {
  const t = useTranslations("nexus.journal");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { supabase } = useAuth();
  const invalidate = useInvalidate();
  const calls = useOpenCalls();
  const requestedCall = useQueryParam("call");
  const [callId, setCallId] = useState(requestedCall ?? "");
  const [work, setWork] = useState<WorkValue>(blankWork);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pledged, setPledged] = useState(false);
  const [partial, setPartial] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const pathway = useSubmitPathway(calls.data, callId, partnerId);
  const { call, callable, callPathways, isMember, throughPartner } = pathway;
  const kinds = kindsFor(work.category);

  const send = useMutation({
    mutationFn: async () => {
      const created = await journal.createSubmission(supabase, {
        body_html: work.body_html || undefined,
        call_id: call?.id ?? "",
        category: work.category,
        cover_note: work.cover_note || undefined,
        human_authorship_confirmed: true,
        language: work.language,
        partner_id: throughPartner,
        rights_note: work.rights_note || undefined,
        source_author: work.source_author || undefined,
        source_text: work.source_text || undefined,
        title: work.title.trim(),
      });
      if (!created) {
        throw new Error("not_created");
      }
      const results = await Promise.allSettled(
        files
          .filter((f) => kinds.includes(f.kind))
          .map((f) => attachFile(supabase, created.id, f))
      );
      if (results.some((r) => r.status === "rejected")) {
        setPartial(created.id);
        return null;
      }
      return created.id;
    },
    onSuccess: async (id) => {
      await invalidate();
      if (id) {
        router.push({ pathname: "/journal/submission", query: { id } });
      }
    },
  });

  if (!calls.data || pathway.pending) {
    return <SectionSpinner />;
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate();
  };
  const ready =
    Boolean(call) &&
    pledged &&
    workIsReady(work, files.filter((f) => kinds.includes(f.kind)).length);

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/journal"
          >
            {t("back")}
          </Link>
        }
        title={t("submitTitle")}
      >
        {t("submitLede")}
      </AdminHeading>
      {call ? null : <p>{t("noCall")}</p>}
      {call ? (
        <form className="grid max-w-3xl gap-6" onSubmit={submit}>
          <Field label={t("call")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) => setCallId(e.target.value)}
                value={call.id}
              >
                {callable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localized(c, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <PartnerPathway
            isMember={isMember}
            onChange={setPartnerId}
            pathways={callPathways}
            value={throughPartner}
          />
          <WorkFields onChange={setWork} value={work} />
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-medium">{t("files.title")}</legend>
            <p className="type-caption">{t("files.note")}</p>
            <FilePicker
              kinds={kinds}
              onAdd={(added) => setFiles((current) => [...current, ...added])}
            />
            <PendingList
              files={files.filter((f) => kinds.includes(f.kind))}
              onRemove={(index) =>
                setFiles((current) =>
                  current
                    .filter((f) => kinds.includes(f.kind))
                    .filter((_, i) => i !== index)
                )
              }
            />
          </fieldset>
          <AuthorshipPledge checked={pledged} onChange={setPledged} />
          <p className="type-caption">
            {t("limits", {
              hour: formatNumber(journal.MAX_SUBMISSIONS_PER_HOUR),
              max: formatNumber(call.max_per_person),
            })}
          </p>
          <Button
            className="justify-self-start"
            disabled={!ready || send.isPending}
            type="submit"
          >
            {send.isPending ? t("sending") : t("send")}
          </Button>
          <ErrorLine error={send.error} />
          {partial ? (
            <p className="text-sm text-title" role="alert">
              {t("filesFailed")}{" "}
              <Link
                className="underline underline-offset-4"
                href={{
                  pathname: "/journal/submission",
                  query: { id: partial },
                }}
              >
                {t("openSubmission")}
              </Link>
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
};

// ── One submission ──────────────────────────────────────────────────────────

const Agreement = ({ submissionId }: { submissionId: string }) => {
  const t = useTranslations("nexus.journal.agreement");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const agreement = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("agreements")
          .select("signed_at, signer_name, version")
          .eq("submission_id", submissionId)
          .maybeSingle()
      ),
    queryKey: ["agreement", submissionId],
  });
  const sign = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("journal").rpc("sign_agreement", {
          signer_name: name.trim(),
          submission_id: submissionId,
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["agreement", submissionId] }),
  });

  if (agreement.isPending) {
    return <SectionSpinner />;
  }
  return (
    <section className="grid max-w-3xl gap-3 rounded-card bg-surface-tint p-4">
      <h2 className="type-subheading">{t("title")}</h2>
      {agreement.data ? (
        <p>
          {t("signed", {
            date: formatLongDate(agreement.data.signed_at, locale),
            name: agreement.data.signer_name,
          })}
        </p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            sign.mutate();
          }}
        >
          <p className="whitespace-pre-wrap">{t("body")}</p>
          <Field hint={t("nameHint")} label={t("name")}>
            {(id) => (
              <Input
                autoComplete="name"
                id={id}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            )}
          </Field>
          <Button
            className="justify-self-start"
            disabled={name.trim().length < 2 || sign.isPending}
            type="submit"
          >
            {t("sign")}
          </Button>
          <ErrorLine error={sign.error} />
        </form>
      )}
    </section>
  );
};

export const MySubmission = () => {
  const t = useTranslations("nexus.journal");
  const tj = useTranslations("nexus.admin.journal");
  const id = useQueryParam("id");
  const { supabase } = useAuth();
  const invalidate = useInvalidate();
  const [work, setWork] = useState<WorkValue>(blankWork);
  const [adding, setAdding] = useState<PendingFile[]>([]);

  const data = useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const [row, files, history] = await Promise.all([
        supabase
          .schema("journal")
          .from("submissions")
          .select("*")
          .eq("id", id ?? "")
          .maybeSingle(),
        supabase
          .schema("journal")
          .from("submission_files")
          .select("id, kind, mime_type, storage_path, created_at")
          .eq("submission_id", id ?? "")
          .order("created_at"),
        supabase
          .schema("journal")
          .from("status_history")
          .select("id, to_status, changed_at")
          .eq("submission_id", id ?? "")
          .order("changed_at"),
      ]);
      return {
        files: unwrap(files) ?? [],
        history: unwrap(history) ?? [],
        row: unwrap(row),
      };
    },
    queryKey: ["submission", id],
  });
  const row = data.data?.row;

  useEffect(() => {
    if (row) {
      setWork({
        body_html: row.body_html ?? "",
        category: row.category,
        cover_note: row.cover_note ?? "",
        language: row.language,
        rights_note: row.rights_note ?? "",
        source_author: row.source_author ?? "",
        source_text: row.source_text ?? "",
        title: row.title,
      });
    }
  }, [row]);

  const refresh = async () => {
    await data.refetch();
    await invalidate();
  };
  const save = useMutation({
    mutationFn: async () => {
      unwrap(
        await supabase
          .schema("journal")
          .from("submissions")
          .update(revisableColumns(work))
          .eq("id", id ?? "")
      );
      await Promise.all(adding.map((f) => attachFile(supabase, id ?? "", f)));
    },
    onSuccess: async () => {
      setAdding([]);
      await refresh();
    },
  });
  const removeFile = useMutation({
    mutationFn: (file: { id: string; storage_path: string }) =>
      detachFile(supabase, file),
    onSuccess: refresh,
  });
  const withdraw = useMutation({
    mutationFn: () => journal.transition(supabase, id ?? "", "withdrawn"),
    onSuccess: refresh,
  });

  const back = (
    <Link className="text-sm underline underline-offset-4" href="/journal">
      {t("back")}
    </Link>
  );
  if (data.isPending && id) {
    return <SectionSpinner />;
  }
  if (!row) {
    return (
      <div className="grid gap-4">
        <AdminHeading actions={back} title={t("submissionTitle")} />
        <p>{t("notFound")}</p>
      </div>
    );
  }
  const editable =
    row.status === "received" ||
    (row.status === "intake_check" && row.intake_returned_at !== null);
  const kinds = kindsFor(row.category);
  const fileCount = (data.data?.files.length ?? 0) + adding.length;

  return (
    <div className="grid gap-8">
      <AdminHeading actions={back} title={row.title}>
        {tj(`categories.${row.category}`)} · {t(`status.${row.status}`)}
      </AdminHeading>

      {row.status === "intake_check" && row.intake_returned_at ? (
        <section
          className="grid gap-2 rounded-card bg-surface-tint p-4"
          role="status"
        >
          <h2 className="font-medium">{t("returnedTitle")}</h2>
          <p className="whitespace-pre-wrap">{row.intake_note}</p>
          <p className="type-caption">{t("returnedHint")}</p>
        </section>
      ) : null}

      {row.status === "accepted" ? <Agreement submissionId={row.id} /> : null}

      <ReadingTimeline history={data.data?.history ?? []} status={row.status} />

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("files.title")}</h2>
        {data.data?.files.length ? (
          <ul className="grid gap-1">
            {data.data.files.map((f, index) => (
              <li className="flex flex-wrap items-center gap-3" key={f.id}>
                <span className="text-sm">
                  {t(
                    `files.kinds.${f.kind as "manuscript" | "image" | "source"}`
                  )}{" "}
                  {formatNumber(index + 1)}
                </span>
                {editable ? (
                  <Button
                    disabled={removeFile.isPending}
                    onClick={() => removeFile.mutate(f)}
                    size="sm"
                    variant="ghost"
                  >
                    {t("files.remove")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-caption">{t("files.none")}</p>
        )}
        <ErrorLine error={removeFile.error} />
      </section>

      {editable ? (
        <form
          className="grid max-w-3xl gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="type-subheading">{t("revise")}</h2>
          <WorkFields fixedKind onChange={setWork} value={work} />
          <FilePicker
            kinds={kinds}
            onAdd={(added) => setAdding((current) => [...current, ...added])}
          />
          <PendingList
            files={adding}
            onRemove={(index) =>
              setAdding((current) => current.filter((_, i) => i !== index))
            }
          />
          <SaveButton
            disabled={!workIsReady(work, fileCount)}
            pending={save.isPending}
            success={save.isSuccess}
          />
          <ErrorLine error={save.error} />
        </form>
      ) : null}

      {FINAL.includes(row.status) ? null : (
        <section className="grid gap-2">
          <h2 className="type-subheading">{t("withdrawTitle")}</h2>
          <p className="type-caption">{t("withdrawNote")}</p>
          <div>
            <ConfirmAction
              confirmLabel={t("withdraw")}
              description={t("withdrawConfirm")}
              disabled={withdraw.isPending}
              onConfirm={() => withdraw.mutate()}
            >
              {t("withdraw")}
            </ConfirmAction>
          </div>
          <ErrorLine error={withdraw.error} />
        </section>
      )}
    </div>
  );
};

const STAGES = [
  "received",
  "intake_check",
  "in_review",
  "selection",
  "decision",
] as const;

const stageOf = (status: string): (typeof STAGES)[number] => {
  if (status === "third_read") {
    return "in_review";
  }
  if (
    status === "accepted" ||
    status === "declined" ||
    status === "withdrawn"
  ) {
    return "decision";
  }
  return (STAGES as readonly string[]).includes(status)
    ? (status as (typeof STAGES)[number])
    : "received";
};

/**
 * Where a submission stands in the reading, stage by stage, with what each
 * stage means. Names never appear: readers work from blind ids.
 */
const ReadingTimeline = ({
  history,
  status,
}: {
  readonly history: { changed_at: string; id: number; to_status: string }[];
  readonly status: string;
}) => {
  const t = useTranslations("nexus.journal");
  const locale = useLocale() as Locale;
  const current = STAGES.indexOf(stageOf(status));
  const reachedAt = (stage: (typeof STAGES)[number]) =>
    history.find((h) => stageOf(h.to_status) === stage)?.changed_at;

  return (
    <section aria-labelledby="timeline" className="grid gap-3">
      <h2 className="type-subheading" id="timeline">
        {t("progress")}
      </h2>
      <ol className="grid">
        {STAGES.map((stage, index) => {
          let state: "done" | "current" | "next" = "next";
          if (index < current) {
            state = "done";
          } else if (index === current) {
            state = "current";
          }
          const at = reachedAt(stage);
          return (
            <li
              aria-current={state === "current" ? "step" : undefined}
              className="grid grid-cols-[1.5rem_1fr] gap-3 border-rule border-b py-3"
              key={stage}
            >
              <span
                aria-hidden="true"
                className={
                  state === "next"
                    ? "frame mt-1 size-4"
                    : "frame mt-1 size-4 bg-band"
                }
              />
              <div className="grid gap-1">
                <p
                  className={
                    state === "next" ? "text-text-secondary" : "font-bold"
                  }
                >
                  {stage === "decision" && index <= current
                    ? t(`status.${status as "accepted"}`)
                    : t(`timeline.${stage}.title`)}
                  {at ? (
                    <span className="type-caption ms-2 font-normal">
                      {formatLongDate(at, locale)}
                    </span>
                  ) : null}
                </p>
                <p className="type-caption">{t(`timeline.${stage}.body`)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="type-caption">{t("blindNote")}</p>
    </section>
  );
};

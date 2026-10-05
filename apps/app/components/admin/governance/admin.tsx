"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { Locale } from "@repo/internationalization";
import { formatIqd, formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermission, hasPermissionAnywhere } from "@repo/rbac";
import { governance, localized, unwrap } from "@repo/sal-data";
import { uploadLibraryFile } from "@repo/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { callApi } from "@/lib/api";
import { useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  type Column,
  ConfirmAction,
  DataTable,
  ErrorLine,
  ExportButton,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";
import { Elections } from "./elections";

const key = ["admin", "governance"];
const RESOLUTION_CODE = /^R-\d{4}-\d{2,3}$/;

type Status =
  | "draft"
  | "adopted"
  | "rejected"
  | "withdrawn"
  | "superseded"
  | "pending"
  | "approved";

// ── Council ─────────────────────────────────────────────────────────────────

const Council = () => {
  const t = useTranslations("nexus.admin.governance.council");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const [form, setForm] = useState({
    ends_on: "",
    name: { ar: "", en: "" },
    starts_on: "",
  });
  const roster = useQuery({
    queryFn: () => governance.councilRoster(supabase),
    queryKey: [...key, "roster"],
  });
  const terms = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("council_terms")
          .select("*")
          .order("starts_on", { ascending: false })
      ) ?? [],
    queryKey: [...key, "terms"],
  });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("governance").from("council_terms").insert({
          ends_on: form.ends_on,
          name_ar: form.name.ar,
          name_en: form.name.en,
          starts_on: form.starts_on,
        })
      ),
    onSuccess: async () => {
      setForm({ ends_on: "", name: { ar: "", en: "" }, starts_on: "" });
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const rows = (roster.data ?? []) as Record<string, unknown>[];

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h3 className="type-subheading">{t("roster")}</h3>
        <p className="type-caption">{t("rosterHint")}</p>
        {roster.isPending ? <SectionSpinner /> : null}
        {roster.data && rows.length === 0 ? (
          <p className="type-body text-text-secondary">{t("empty")}</p>
        ) : null}
        <ul className="grid gap-gap sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={`${String(row.role)}-${String(row.full_name_en)}`}>
              <SalCard>
                <p className="type-kicker">
                  {localized(row, "title", locale) ||
                    localized(row, "role_name", locale)}
                </p>
                <p className="font-bold">
                  {localized(row, "full_name", locale)}
                </p>
              </SalCard>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3">
        <h3 className="type-subheading">{t("terms")}</h3>
        <ul className="grid gap-1">
          {terms.data?.map((term) => (
            <li key={term.id}>
              <span className="font-medium">
                {localized(term, "name", locale)}
              </span>{" "}
              · {formatLongDate(term.starts_on, locale, true)} –{" "}
              {formatLongDate(term.ends_on, locale, true)}
            </li>
          ))}
        </ul>
        {hasPermission(grants.data, "governance.manage") ? (
          <form
            className="grid max-w-3xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <h4 className="font-bold text-sm">{t("newTerm")}</h4>
            <BilingualField
              label={t("name")}
              maxLength={120}
              onChange={(name) => setForm((f) => ({ ...f, name }))}
              required
              value={form.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("startsOn")}>
                {(id) => (
                  <Input
                    dir="ltr"
                    id={id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, starts_on: e.target.value }))
                    }
                    required
                    type="date"
                    value={form.starts_on}
                  />
                )}
              </Field>
              <Field label={t("endsOn")}>
                {(id) => (
                  <Input
                    dir="ltr"
                    id={id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ends_on: e.target.value }))
                    }
                    required
                    type="date"
                    value={form.ends_on}
                  />
                )}
              </Field>
            </div>
            <SaveButton pending={add.isPending} />
            <ErrorLine error={add.error} />
          </form>
        ) : null}
      </section>
    </div>
  );
};

// ── Minutes list ────────────────────────────────────────────────────────────

const MinutesList = () => {
  const t = useTranslations("nexus.admin.governance");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const minutes = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("minutes")
          .select(
            "id, body, meeting_on, title_en, title_ar, status, adopted_on"
          )
          .order("meeting_on", { ascending: false })
      ) ?? [],
    queryKey: [...key, "minutes"],
  });
  type Row = NonNullable<typeof minutes.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (m) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/admin/governance/minutes", query: { id: m.id } }}
        >
          {localized(m, "title", locale)}
        </Link>
      ),
      header: t("minutes.titleField"),
      key: "title",
    },
    {
      cell: (m) => formatLongDate(m.meeting_on, locale, true),
      className: "whitespace-nowrap",
      header: t("minutes.meetingOn"),
      key: "date",
    },
    {
      cell: (m) => t(`bodies.${m.body as "council" | "general_assembly"}`),
      header: t("minutes.body"),
      key: "body",
    },
    {
      cell: (m) =>
        m.status === "adopted" && m.adopted_on
          ? `${t("statuses.adopted")}, ${formatLongDate(m.adopted_on, locale, true)}`
          : t("statuses.draft"),
      header: "",
      key: "status",
    },
  ];
  return (
    <div className="grid gap-4">
      <Link
        className="inline-flex h-8 items-center justify-self-start rounded-md bg-primary px-3 text-primary-foreground text-sm"
        href="/admin/governance/minutes"
      >
        {t("minutes.new")}
      </Link>
      <p className="type-caption">{t("minutes.draftNote")}</p>
      {minutes.data ? (
        <DataTable columns={columns} rowKey={(m) => m.id} rows={minutes.data} />
      ) : (
        <SectionSpinner />
      )}
    </div>
  );
};

// ── Resolutions ─────────────────────────────────────────────────────────────

interface ResolutionForm {
  adopted_on: string;
  body: "council" | "general_assembly";
  code: string;
  id: string | null;
  minutes_id: string;
  status: "draft" | "adopted" | "rejected" | "withdrawn";
  text: { ar: string; en: string };
  title: { ar: string; en: string };
  votes: { abstain: string; against: string; for: string };
}

const blankResolution = (): ResolutionForm => ({
  adopted_on: "",
  body: "council",
  code: `R-${new Date().getFullYear()}-`,
  id: null,
  minutes_id: "",
  status: "draft",
  text: { ar: "", en: "" },
  title: { ar: "", en: "" },
  votes: { abstain: "", against: "", for: "" },
});

const toCount = (value: string) => (value === "" ? null : Number(value));

const Resolutions = () => {
  const t = useTranslations("nexus.admin.governance");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ResolutionForm>(blankResolution);
  const [problem, setProblem] = useState<string | null>(null);
  const data = useQuery({
    queryFn: async () => {
      const [resolutions, minutes] = await Promise.all([
        supabase
          .schema("governance")
          .from("resolutions")
          .select("*")
          .order("code", { ascending: false }),
        supabase
          .schema("governance")
          .from("minutes")
          .select("id, title_en, title_ar, meeting_on")
          .order("meeting_on", { ascending: false }),
      ]);
      return {
        minutes: unwrap(minutes) ?? [],
        resolutions: unwrap(resolutions) ?? [],
      };
    },
    queryKey: [...key, "resolutions"],
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!RESOLUTION_CODE.test(form.code)) {
        setProblem(t("resolutions.codeError"));
        throw new Error("invalid");
      }
      if ((form.status === "adopted") !== Boolean(form.adopted_on)) {
        setProblem(t("resolutions.adoptedOnError"));
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        adopted_on: form.adopted_on || null,
        body: form.body,
        code: form.code,
        minutes_id: form.minutes_id || null,
        status: form.status,
        text_ar: form.text.ar || null,
        text_en: form.text.en,
        title_ar: form.title.ar || null,
        title_en: form.title.en,
        votes_abstain: toCount(form.votes.abstain),
        votes_against: toCount(form.votes.against),
        votes_for: toCount(form.votes.for),
      };
      const table = supabase.schema("governance").from("resolutions");
      unwrap(
        form.id
          ? await table.update(row).eq("id", form.id)
          : await table.insert(row)
      );
    },
    onSuccess: async () => {
      setForm(blankResolution());
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  type Row = NonNullable<typeof data.data>["resolutions"][number];
  const columns: Column<Row>[] = [
    {
      cell: (r) => <span className="type-code">{r.code}</span>,
      header: t("resolutions.code"),
      key: "code",
    },
    {
      cell: (r) => (
        <button
          className="text-start font-medium underline underline-offset-4"
          onClick={() =>
            setForm({
              adopted_on: r.adopted_on ?? "",
              body: r.body as "council" | "general_assembly",
              code: r.code,
              id: r.id,
              minutes_id: r.minutes_id ?? "",
              status: r.status as ResolutionForm["status"],
              text: { ar: r.text_ar ?? "", en: r.text_en },
              title: { ar: r.title_ar ?? "", en: r.title_en },
              votes: {
                abstain: r.votes_abstain?.toString() ?? "",
                against: r.votes_against?.toString() ?? "",
                for: r.votes_for?.toString() ?? "",
              },
            })
          }
          type="button"
        >
          {localized(r, "title", locale)}
        </button>
      ),
      header: t("resolutions.titleField"),
      key: "title",
    },
    {
      cell: (r) =>
        r.status === "adopted" && r.adopted_on
          ? `${t("statuses.adopted")}, ${formatLongDate(r.adopted_on, locale, true)}`
          : t(`statuses.${r.status as Status}`),
      header: tk("status"),
      key: "status",
    },
  ];

  return (
    <div className="grid gap-6">
      {data.data ? (
        <DataTable
          columns={columns}
          rowKey={(r) => r.id}
          rows={data.data.resolutions}
        />
      ) : (
        <SectionSpinner />
      )}
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="type-subheading">
          {form.id ? t("resolutions.edit") : t("resolutions.new")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("resolutions.code")}>
            {(id) => (
              <Input
                className="type-code"
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                required
                value={form.code}
              />
            )}
          </Field>
          <Field label={t("minutes.body")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    body: e.target.value as ResolutionForm["body"],
                  }))
                }
                value={form.body}
              >
                <option value="council">{t("bodies.council")}</option>
                <option value="general_assembly">
                  {t("bodies.general_assembly")}
                </option>
              </SelectInput>
            )}
          </Field>
        </div>
        <BilingualField
          label={t("resolutions.titleField")}
          maxLength={300}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          value={form.title}
        />
        <BilingualField
          label={t("resolutions.text")}
          multiline
          onChange={(text) => setForm((f) => ({ ...f, text }))}
          rows={5}
          value={form.text}
        />
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 font-medium text-sm">
            {t("resolutions.votes")}
          </legend>
          {(["for", "against", "abstain"] as const).map((vote) => (
            <Field key={vote} label={t(`resolutions.${vote}`)}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  min={0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      votes: { ...f.votes, [vote]: e.target.value },
                    }))
                  }
                  type="number"
                  value={form.votes[vote]}
                />
              )}
            </Field>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tk("status")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ResolutionForm["status"],
                  }))
                }
                value={form.status}
              >
                {(["draft", "adopted", "rejected", "withdrawn"] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  )
                )}
              </SelectInput>
            )}
          </Field>
          <Field label={t("minutes.adoptedOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, adopted_on: e.target.value }))
                }
                type="date"
                value={form.adopted_on}
              />
            )}
          </Field>
          <Field label={t("resolutions.minutes")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minutes_id: e.target.value }))
                }
                value={form.minutes_id}
              >
                <option value="">{t("resolutions.noMinutes")}</option>
                {data.data?.minutes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatLongDate(m.meeting_on, locale, true)} ·{" "}
                    {localized(m, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        <div className="flex gap-3">
          <SaveButton pending={save.isPending} />
          {form.id ? (
            <Button
              onClick={() => setForm(blankResolution())}
              type="button"
              variant="ghost"
            >
              {t("resolutions.new")}
            </Button>
          ) : null}
        </div>
        {save.error && save.error.message !== "invalid" ? (
          <ErrorLine error={save.error} />
        ) : null}
      </form>
    </div>
  );
};

// ── Spending ────────────────────────────────────────────────────────────────

const Spending = () => {
  const t = useTranslations("nexus.admin.governance");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const [form, setForm] = useState({
    amount: "",
    purpose: { ar: "", en: "" },
    resolution_id: "",
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const data = useQuery({
    queryFn: async () => {
      const [approvals, resolutions] = await Promise.all([
        supabase
          .schema("governance")
          .from("spending_approvals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .schema("governance")
          .from("resolutions")
          .select("id, code, title_en, title_ar")
          .eq("status", "adopted"),
      ]);
      return {
        approvals: unwrap(approvals) ?? [],
        resolutions: unwrap(resolutions) ?? [],
      };
    },
    queryKey: [...key, "spending"],
  });
  const names = useMemberNames(
    (data.data?.approvals ?? []).flatMap((a) => [
      a.requested_by,
      a.lead_approver,
      a.treasurer_approver,
    ])
  );
  const nameOf = (id: string | null) => {
    const p = names.data?.find((n) => n.id === id);
    return p ? memberName(p, locale) : "—";
  };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const request = useMutation({
    mutationFn: async () => {
      const input = governance.spendingRequestSchema.parse({
        amount_iqd: Number(form.amount),
        purpose_ar: form.purpose.ar || undefined,
        purpose_en: form.purpose.en,
        resolution_id: form.resolution_id || undefined,
      });
      unwrap(
        await supabase.schema("governance").rpc("request_spending", input)
      );
    },
    onSuccess: async () => {
      setForm({ amount: "", purpose: { ar: "", en: "" }, resolution_id: "" });
      await invalidate();
    },
  });
  const approve = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("governance")
          .rpc("approve_spending", { approval_id: id })
      ),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("governance")
          .rpc("reject_spending", { approval_id: id, note: notes[id] ?? "" })
      ),
    onSuccess: invalidate,
  });

  const canRequest = hasPermission(grants.data, "spending.request");
  const canDecide =
    hasPermissionAnywhere(grants.data, "spending.countersign") ||
    hasPermission(grants.data, "spending.request");
  const amount = Number(form.amount) || 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="type-body text-text-secondary">{t("spending.lede")}</p>
        <ExportButton fileName="sal-spending.csv" name="spending" />
      </div>
      <ul className="grid gap-3">
        {data.data?.approvals.map((a) => (
          <li key={a.id}>
            <SalCard>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold tabular-nums">
                  {formatIqd(a.amount_iqd, locale)}
                </p>
                <p className="type-caption">
                  {t(`statuses.${a.status as Status}`)}
                </p>
              </div>
              <p>{localized(a, "purpose", locale)}</p>
              <p className="type-caption">
                {t("spending.requestedBy", { name: nameOf(a.requested_by) })} ·{" "}
                {formatLongDate(a.created_at, locale, true)}
                {a.lead_approver
                  ? ` · ${t("spending.lead", { name: nameOf(a.lead_approver) })}`
                  : ""}
                {a.treasurer_approver
                  ? ` · ${t("spending.treasurer", { name: nameOf(a.treasurer_approver) })}`
                  : ""}
              </p>
              {a.decision_note ? (
                <p className="type-caption">{a.decision_note}</p>
              ) : null}
              {a.status === "pending" && canDecide ? (
                <div className="flex flex-wrap items-end gap-3">
                  <ConfirmAction
                    confirmLabel={t("spending.approve")}
                    description={t("spending.approveConfirm", {
                      amount: formatIqd(a.amount_iqd, locale),
                      purpose: localized(a, "purpose", locale),
                    })}
                    disabled={approve.isPending}
                    onConfirm={() => approve.mutate(a.id)}
                    variant="default"
                  >
                    {t("spending.approve")}
                  </ConfirmAction>
                  <Input
                    aria-label={t("spending.rejectNote")}
                    className="h-8 max-w-xs"
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [a.id]: e.target.value }))
                    }
                    placeholder={t("spending.rejectNote")}
                    value={notes[a.id] ?? ""}
                  />
                  <ConfirmAction
                    confirmLabel={t("spending.reject")}
                    description={t("spending.rejectConfirm")}
                    disabled={reject.isPending}
                    onConfirm={() => reject.mutate(a.id)}
                  >
                    {t("spending.reject")}
                  </ConfirmAction>
                </div>
              ) : null}
            </SalCard>
          </li>
        ))}
      </ul>
      <ErrorLine error={approve.error ?? reject.error} />
      {canRequest ? (
        <form
          className="grid max-w-3xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            request.mutate();
          }}
        >
          <h3 className="type-subheading">{t("spending.request")}</h3>
          <BilingualField
            label={t("spending.purpose")}
            maxLength={500}
            onChange={(purpose) => setForm((f) => ({ ...f, purpose }))}
            required
            value={form.purpose}
          />
          <Field label={t("spending.amount")}>
            {(id) => (
              <Input
                className="w-48"
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                required
                type="number"
                value={form.amount}
              />
            )}
          </Field>
          <Field
            hint={
              governance.needsCouncilVote(amount)
                ? t("spending.needsResolution")
                : undefined
            }
            label={t("spending.resolution")}
          >
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, resolution_id: e.target.value }))
                }
                required={governance.needsCouncilVote(amount)}
                value={form.resolution_id}
              >
                <option value="">{t("spending.none")}</option>
                {data.data?.resolutions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {localized(r, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <SaveButton pending={request.isPending} />
          <ErrorLine error={request.error} />
        </form>
      ) : null}
    </div>
  );
};

// ── Library ─────────────────────────────────────────────────────────────────

const Library = () => {
  const t = useTranslations("nexus.admin.governance");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    audience: "role" as "role" | "council",
    code: "",
    status: "draft" as "draft" | "adopted" | "superseded",
    title: { ar: "", en: "" },
    version: "1",
  });
  const documents = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("library_documents")
          .select("*")
          .order("code")
      ) ?? [],
    queryKey: [...key, "library"],
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) {
        return;
      }
      const stored = await uploadLibraryFile(supabase, form.audience, file);
      unwrap(
        await supabase
          .schema("governance")
          .from("library_documents")
          .insert({
            audience: form.audience,
            code: form.code.trim() || null,
            status: form.status,
            storage_path: stored.path,
            title_ar: form.title.ar || null,
            title_en: form.title.en,
            version: form.version || "1",
          })
      );
    },
    onSuccess: async () => {
      setFile(null);
      setForm((f) => ({ ...f, code: "", title: { ar: "", en: "" } }));
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const open = async (id: string) => {
    const { url } = await callApi<{ url: string }>(supabase, "/files/library", {
      id,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  type Row = NonNullable<typeof documents.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (d) => <span className="type-code">{d.code ?? "—"}</span>,
      header: t("library.code"),
      key: "code",
    },
    {
      cell: (d) => localized(d, "title", locale),
      header: t("library.titleField"),
      key: "title",
    },
    {
      cell: (d) => t(`library.audiences.${d.audience as "role" | "council"}`),
      header: t("library.audience"),
      key: "audience",
    },
    {
      cell: (d) => `v${d.version} · ${t(`statuses.${d.status as Status}`)}`,
      header: t("library.status"),
      key: "status",
    },
    {
      cell: (d) => (
        <Button
          onClick={() => open(d.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("library.open")}
        </Button>
      ),
      header: "",
      key: "open",
    },
  ];

  return (
    <div className="grid gap-6">
      <p className="type-body text-text-secondary">{t("library.lede")}</p>
      {documents.data ? (
        <DataTable
          columns={columns}
          empty={t("library.empty")}
          rowKey={(d) => d.id}
          rows={documents.data}
        />
      ) : (
        <SectionSpinner />
      )}
      {hasPermission(grants.data, "governance.manage") ? (
        <form
          className="grid max-w-3xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <h3 className="type-subheading">{t("library.upload")}</h3>
          <Field label={t("library.file")}>
            {(id) => (
              <Input
                id={id}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                type="file"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("library.code")}>
              {(id) => (
                <Input
                  className="type-code"
                  dir="ltr"
                  id={id}
                  maxLength={40}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  value={form.code}
                />
              )}
            </Field>
            <Field label={t("library.version")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  maxLength={20}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, version: e.target.value }))
                  }
                  value={form.version}
                />
              )}
            </Field>
            <Field label={t("library.audience")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      audience: e.target.value as "role" | "council",
                    }))
                  }
                  value={form.audience}
                >
                  <option value="role">{t("library.audiences.role")}</option>
                  <option value="council">
                    {t("library.audiences.council")}
                  </option>
                </SelectInput>
              )}
            </Field>
            <Field label={t("library.status")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as typeof form.status,
                    }))
                  }
                  value={form.status}
                >
                  {(["draft", "adopted", "superseded"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
          <BilingualField
            label={t("library.titleField")}
            maxLength={300}
            onChange={(title) => setForm((f) => ({ ...f, title }))}
            required
            value={form.title}
          />
          <SaveButton disabled={!file} pending={upload.isPending} />
          <ErrorLine error={upload.error} />
        </form>
      ) : null}
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const GovernanceAdmin = () => {
  const t = useTranslations("nexus.admin.governance");
  const grants = useGrants();
  const has = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(grants.data, permission);
  const tabs = [
    { show: true, value: "council" },
    {
      show: has("governance.minutes.write") || has("governance.manage"),
      value: "minutes",
    },
    {
      show: has("governance.minutes.write") || has("governance.manage"),
      value: "resolutions",
    },
    {
      show:
        has("governance.manage") ||
        has("spending.request") ||
        hasPermissionAnywhere(grants.data, "spending.countersign"),
      value: "spending",
    },
    {
      show:
        hasPermissionAnywhere(grants.data, "library.read") ||
        has("governance.manage"),
      value: "library",
    },
    { show: has("elections.manage"), value: "elections" },
  ] as const;
  const shown = tabs.filter((tab) => tab.show);

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue="council">
        <TabsList className="flex-wrap">
          {shown.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {t(`tabs.${tab.value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="pt-4" value="council">
          <Council />
        </TabsContent>
        {shown.some((tab) => tab.value === "minutes") ? (
          <>
            <TabsContent className="pt-4" value="minutes">
              <MinutesList />
            </TabsContent>
            <TabsContent className="pt-4" value="resolutions">
              <Resolutions />
            </TabsContent>
          </>
        ) : null}
        {shown.some((tab) => tab.value === "spending") ? (
          <TabsContent className="pt-4" value="spending">
            <Spending />
          </TabsContent>
        ) : null}
        {shown.some((tab) => tab.value === "library") ? (
          <TabsContent className="pt-4" value="library">
            <Library />
          </TabsContent>
        ) : null}
        {shown.some((tab) => tab.value === "elections") ? (
          <TabsContent className="pt-4" value="elections">
            <Elections />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermissionAnywhere } from "@repo/rbac";
import { localized, recognition, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useFlags, useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  type Column,
  ConfirmAction,
  DataTable,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { MemberPicker, useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const key = ["admin", "recognition"];

type CertificateStatus = "draft" | "issued" | "revoked";

// ── Hours to confirm ────────────────────────────────────────────────────────

interface PendingRow {
  activity: string;
  hours: number;
  id: string;
  occurred_on: string;
  user_id: string;
  what: string | null;
}

const PendingHours = () => {
  const t = useTranslations("nexus.admin.recognition.pending");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const pending = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("membership")
          .from("service_records")
          .select("id, user_id, occurred_on, activity, what, hours")
          .eq("status", "pending")
          .neq("user_id", user?.id ?? "")
          .order("occurred_on")
      ) ?? []) as PendingRow[],
    queryKey: [...key, "pending"],
  });
  const rows = pending.data ?? [];
  const names = useMemberNames(rows.map((r) => r.user_id));
  const decide = useMutation({
    mutationFn: ({
      approve,
      id,
      reason,
    }: {
      approve: boolean;
      id: string;
      reason?: string;
    }) => recognition.confirmService(supabase, id, approve, reason),
    onSuccess: async () => {
      setRejecting(null);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const nameOf = (id: string) => {
    const row = names.data?.find((n) => n.id === id);
    return row ? memberName(row, locale) : "";
  };

  const actions = (row: PendingRow) => {
    if (rejecting?.id === row.id) {
      return (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            decide.mutate({
              approve: false,
              id: row.id,
              reason: rejecting.reason,
            });
          }}
        >
          <Input
            aria-label={t("reason")}
            className="max-w-48"
            dir="auto"
            maxLength={500}
            onChange={(e) =>
              setRejecting({ id: row.id, reason: e.target.value })
            }
            placeholder={t("reason")}
            value={rejecting.reason}
          />
          <Button disabled={decide.isPending} size="sm" type="submit">
            {t("reject")}
          </Button>
        </form>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={decide.isPending}
          onClick={() => decide.mutate({ approve: true, id: row.id })}
          size="sm"
        >
          {t("confirm")}
        </Button>
        <Button
          onClick={() => setRejecting({ id: row.id, reason: "" })}
          size="sm"
          variant="outline"
        >
          {t("reject")}
        </Button>
      </div>
    );
  };

  const columns: Column<PendingRow>[] = [
    { cell: (row) => nameOf(row.user_id), header: t("person"), key: "person" },
    {
      cell: (row) => formatLongDate(row.occurred_on, locale, true),
      header: t("date"),
      key: "date",
    },
    {
      cell: (row) => (
        <div className="grid" dir="auto">
          <span className="font-medium">{row.activity}</span>
          {row.what ? <span className="type-caption">{row.what}</span> : null}
        </div>
      ),
      header: t("activity"),
      key: "activity",
    },
    {
      cell: (row) => formatNumber(Number(row.hours)),
      header: t("hours"),
      key: "hours",
    },
    { cell: actions, header: "", key: "actions" },
  ];

  if (pending.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-4">
      <p className="type-body">{t("lede")}</p>
      <ErrorLine error={decide.error} />
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.id}
        rows={rows}
      />
    </div>
  );
};

// ── Totals ──────────────────────────────────────────────────────────────────

const Totals = () => {
  const t = useTranslations("nexus.admin.recognition.totals");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const totals = useQuery({
    queryFn: () => recognition.serviceTotals(supabase),
    queryKey: [...key, "totals"],
  });
  type Row = Awaited<ReturnType<typeof recognition.serviceTotals>>[number];
  const columns: Column<Row>[] = [
    {
      cell: (row) => memberName(row, locale),
      header: t("person"),
      key: "person",
    },
    {
      cell: (row) => formatNumber(Number(row.hours)),
      header: t("hours"),
      key: "hours",
    },
    {
      cell: (row) => (row.fellowship_eligible ? t("eligible") : ""),
      header: t("fellowship"),
      key: "fellowship",
    },
  ];
  if (totals.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-4">
      <p className="type-body">
        {t("lede", { target: formatNumber(recognition.FELLOWSHIP_HOURS) })}
      </p>
      <p className="type-caption">{t("cap")}</p>
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.user_id}
        rows={totals.data ?? []}
      />
    </div>
  );
};

// ── Certificates ────────────────────────────────────────────────────────────

interface CertificateRow {
  advisor_signed_by: string | null;
  id: string;
  issued_at: string | null;
  kind: string;
  president_signed_by: string | null;
  role_ar: string | null;
  role_en: string | null;
  serial: string | null;
  status: string;
  user_id: string;
}

const emptyForm = {
  citation: { ar: "", en: "" },
  hours: "",
  kind: "service" as recognition.CertificateKind,
  partner_id: "",
  period_from: "",
  period_to: "",
  resolution_id: "",
  role: { ar: "", en: "" },
};

const PrepareForm = ({ onDone }: { onDone: () => void }) => {
  const t = useTranslations("nexus.admin.recognition.certificates");
  const tKinds = useTranslations("nexus.certificate.titles");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const flags = useFlags();
  const [person, setPerson] = useState<{
    full_name_ar: string | null;
    full_name_en: string;
    id: string;
  } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const resolutions = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("resolutions")
          .select("id, code, title_en, title_ar")
          .eq("status", "adopted")
          .order("code", { ascending: false })
      ) ?? [],
    queryKey: [...key, "resolutions"],
  });
  const partnerOptions = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("partners")
          .select("id, name_en, name_ar")
          .order("name_en")
      ) ?? [],
    queryKey: [...key, "partners"],
  });
  const kinds = recognition.certificateKinds.filter(
    (kind) => kind !== "volunteer" || flags.data?.volunteer_certificates
  );
  const save = useMutation({
    mutationFn: async () => {
      const row = recognition.certificateSchema.parse({
        citation_ar: form.citation.ar,
        citation_en: form.citation.en,
        hours: form.hours ? Number(form.hours) : null,
        kind: form.kind,
        partner_id: form.partner_id || null,
        period_from: form.period_from,
        period_to: form.period_to,
        resolution_id: form.resolution_id || null,
        role_ar: form.role.ar,
        role_en: form.role.en,
        user_id: person?.id ?? "",
      });
      unwrap(
        await supabase.schema("membership").from("certificates").insert(row)
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      onDone();
    },
  });

  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <MemberPicker label={t("holder")} onChange={setPerson} value={person} />
      <Field label={t("kind")}>
        {(id) => (
          <SelectInput
            id={id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                kind: e.target.value as recognition.CertificateKind,
              }))
            }
            value={form.kind}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {tKinds(kind)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <p className="type-caption">{t(`hints.${form.kind}`)}</p>
      {recognition.recordsRole(form.kind) ? (
        <BilingualField
          label={t("role")}
          maxLength={200}
          onChange={(role) => setForm((f) => ({ ...f, role }))}
          required
          value={form.role}
        />
      ) : null}
      {form.kind === "fellowship" || form.kind === "honorary" ? (
        <>
          <BilingualField
            label={t("citation")}
            maxLength={500}
            onChange={(citation) => setForm((f) => ({ ...f, citation }))}
            required
            value={form.citation}
          />
          <Field hint={t("resolutionHint")} label={t("resolution")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, resolution_id: e.target.value }))
                }
                required
                value={form.resolution_id}
              >
                <option value="">{t("chooseResolution")}</option>
                {(resolutions.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {localized(r, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </>
      ) : null}
      {form.kind === "partner" ? (
        <Field label={t("partner")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, partner_id: e.target.value }))
              }
              required
              value={form.partner_id}
            >
              <option value="">{t("choosePartner")}</option>
              {(partnerOptions.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {localized(p, "name", locale)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      ) : null}
      {form.kind === "volunteer" ? (
        <Field label={t("hours")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              min={1}
              onChange={(e) =>
                setForm((f) => ({ ...f, hours: e.target.value }))
              }
              required
              step={0.25}
              type="number"
              value={form.hours}
            />
          )}
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["period_from", "period_to"] as const).map((field) => (
          <Field key={field} label={t(field)}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field]: e.target.value }))
                }
                required={
                  field === "period_from" && recognition.recordsRole(form.kind)
                }
                type="date"
                value={form[field]}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <SaveButton disabled={!person} pending={save.isPending} />
        <Button onClick={onDone} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
      <ErrorLine error={save.error} />
    </form>
  );
};

const Certificates = () => {
  const t = useTranslations("nexus.admin.recognition.certificates");
  const tKinds = useTranslations("nexus.certificate.titles");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const canPrepare = hasPermissionAnywhere(grants.data, "certificates.prepare");
  const canSign = hasPermissionAnywhere(grants.data, "certificates.sign");
  const canCountersign = hasPermissionAnywhere(
    grants.data,
    "certificates.countersign"
  );
  const [preparing, setPreparing] = useState(false);
  const [revoking, setRevoking] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const certificates = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("membership")
          .from("certificates")
          .select(
            "id, user_id, kind, role_en, role_ar, status, serial, issued_at, president_signed_by, advisor_signed_by"
          )
          .order("created_at", { ascending: false })
      ) ?? []) as CertificateRow[],
    queryKey: [...key, "certificates"],
  });
  const rows = certificates.data ?? [];
  const names = useMemberNames(rows.map((r) => r.user_id));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const sign = useMutation({
    mutationFn: (id: string) => recognition.signCertificate(supabase, id),
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      recognition.revokeCertificate(supabase, id, reason),
    onSuccess: async () => {
      setRevoking(null);
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("membership")
          .from("certificates")
          .delete()
          .eq("id", id)
      ),
    onSuccess: invalidate,
  });
  const nameOf = (id: string) => {
    const row = names.data?.find((n) => n.id === id);
    return row ? memberName(row, locale) : "";
  };
  const mySignatureDue = (row: CertificateRow) =>
    row.status === "draft" &&
    row.user_id !== user?.id &&
    ((canSign && !row.president_signed_by) ||
      (canCountersign && !row.advisor_signed_by));

  const signatures = (row: CertificateRow) => {
    if (row.status !== "draft") {
      return row.issued_at ? formatLongDate(row.issued_at, locale, true) : "";
    }
    const done = [
      row.president_signed_by ? t("presidentSigned") : null,
      row.advisor_signed_by ? t("advisorSigned") : null,
    ].filter(Boolean);
    return done.length > 0 ? done.join(" · ") : t("unsigned");
  };

  const actions = (row: CertificateRow) => {
    if (revoking?.id === row.id) {
      return (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            revoke.mutate(revoking);
          }}
        >
          <Input
            aria-label={t("revokeReason")}
            className="max-w-48"
            dir="auto"
            onChange={(e) =>
              setRevoking({ id: row.id, reason: e.target.value })
            }
            placeholder={t("revokeReason")}
            required
            value={revoking.reason}
          />
          <Button disabled={revoke.isPending} size="sm" type="submit">
            {t("revoke")}
          </Button>
        </form>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={{ pathname: "/certificate", query: { id: row.id } }}>
            {t("open")}
          </Link>
        </Button>
        {mySignatureDue(row) ? (
          <Button
            disabled={sign.isPending}
            onClick={() => sign.mutate(row.id)}
            size="sm"
          >
            {canSign && !row.president_signed_by ? t("sign") : t("countersign")}
          </Button>
        ) : null}
        {row.status === "issued" && canSign ? (
          <Button
            onClick={() => setRevoking({ id: row.id, reason: "" })}
            size="sm"
            variant="ghost"
          >
            {t("revoke")}
          </Button>
        ) : null}
        {row.status === "draft" && canPrepare ? (
          <ConfirmAction
            confirmLabel={t("delete")}
            description={t("deleteConfirm")}
            onConfirm={() => remove.mutate(row.id)}
            variant="ghost"
          >
            {t("delete")}
          </ConfirmAction>
        ) : null}
      </div>
    );
  };

  const columns: Column<CertificateRow>[] = [
    { cell: (row) => nameOf(row.user_id), header: t("holder"), key: "holder" },
    {
      cell: (row) => (
        <div className="grid">
          <span>{tKinds(row.kind as recognition.CertificateKind)}</span>
          {row.role_en || row.role_ar ? (
            <span className="type-caption">
              {localized(
                { role_ar: row.role_ar, role_en: row.role_en },
                "role",
                locale
              )}
            </span>
          ) : null}
        </div>
      ),
      header: t("kind"),
      key: "kind",
    },
    {
      cell: (row) => <span dir="ltr">{row.serial ?? t("statuses.draft")}</span>,
      header: t("serial"),
      key: "serial",
    },
    {
      cell: (row) => t(`statuses.${row.status as CertificateStatus}`),
      header: t("status"),
      key: "status",
    },
    { cell: signatures, header: t("signatures"), key: "signatures" },
    { cell: actions, header: "", key: "actions" },
  ];

  if (certificates.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-6">
      <p className="type-body">{t("lede")}</p>
      {preparing ? <PrepareForm onDone={() => setPreparing(false)} /> : null}
      {!preparing && canPrepare ? (
        <Button
          className="justify-self-start"
          onClick={() => setPreparing(true)}
        >
          {t("prepare")}
        </Button>
      ) : null}
      <ErrorLine error={sign.error ?? revoke.error ?? remove.error} />
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.id}
        rows={rows}
      />
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const RecognitionAdmin = () => {
  const t = useTranslations("nexus.admin.recognition");
  const grants = useGrants();
  const canConfirm =
    hasPermissionAnywhere(grants.data, "members.manage") ||
    hasPermissionAnywhere(grants.data, "programmes.manage");
  const canTotals = hasPermissionAnywhere(grants.data, "members.manage");
  const canCertificates =
    hasPermissionAnywhere(grants.data, "certificates.prepare") ||
    hasPermissionAnywhere(grants.data, "certificates.sign") ||
    hasPermissionAnywhere(grants.data, "certificates.countersign");
  let first = "certificates";
  if (canConfirm) {
    first = "pending";
  }

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue={first}>
        <TabsList className="flex-wrap">
          {canConfirm ? (
            <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>
          ) : null}
          {canTotals ? (
            <TabsTrigger value="totals">{t("tabs.totals")}</TabsTrigger>
          ) : null}
          {canCertificates ? (
            <TabsTrigger value="certificates">
              {t("tabs.certificates")}
            </TabsTrigger>
          ) : null}
        </TabsList>
        {canConfirm ? (
          <TabsContent className="pt-4" value="pending">
            <PendingHours />
          </TabsContent>
        ) : null}
        {canTotals ? (
          <TabsContent className="pt-4" value="totals">
            <Totals />
          </TabsContent>
        ) : null}
        {canCertificates ? (
          <TabsContent className="pt-4" value="certificates">
            <Certificates />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};

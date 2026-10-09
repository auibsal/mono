"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { hasPermissionAnywhere } from "@repo/rbac";
import { localized, partners, unwrap } from "@repo/sal-data";
import { uploadLibraryFile } from "@repo/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { callApi } from "@/lib/api";
import { useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import { ImageField } from "../image-field";
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
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const key = ["admin", "partners"];

type PartnerKind = (typeof partners.partnerKinds)[number];
type PartnerReach = (typeof partners.partnerReach)[number];
type PartnerStatus = (typeof partners.partnerStatuses)[number];
type AgreementStatus = "draft" | "signed" | "ended";
type AffiliationStatus = "pending" | "verified" | "declined" | "ended";
type ConflictKind = (typeof partners.conflictKinds)[number];

const today = () => new Date().toISOString().slice(0, 10);

type PartnerRow = {
  id: string;
  kind: string;
  name_ar: string | null;
  name_en: string;
  status: string;
} & Record<string, unknown>;

const usePartners = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("partners")
          .select("*")
          .order("name_en")
      ) ?? []) as PartnerRow[],
    queryKey: [...key, "register"],
  });
};

const usePartnerNames = () => {
  const register = usePartners();
  const locale = useLocale();
  return (id: string) => {
    const row = register.data?.find((p) => p.id === id);
    return row ? localized(row, "name", locale) : "";
  };
};

// ── Register ────────────────────────────────────────────────────────────────

const emptyPartner = {
  contact_email: "",
  contact_name: "",
  contact_role: "",
  description: { ar: "", en: "" },
  is_listed: false,
  kind: "cultural" as (typeof partners.partnerKinds)[number],
  logo_path: null as string | null,
  name: { ar: "", en: "" },
  notes: "",
  reach: "iraq" as (typeof partners.partnerReach)[number],
  slug: "",
  status: "prospect" as (typeof partners.partnerStatuses)[number],
  url: "",
};

const PartnerForm = ({
  initial,
  onDone,
}: {
  initial?: PartnerRow;
  onDone: () => void;
}) => {
  const t = useTranslations("nexus.admin.partners.register");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() =>
    initial
      ? {
          contact_email: String(initial.contact_email ?? ""),
          contact_name: String(initial.contact_name ?? ""),
          contact_role: String(initial.contact_role ?? ""),
          description: {
            ar: String(initial.description_ar ?? ""),
            en: String(initial.description_en ?? ""),
          },
          is_listed: Boolean(initial.is_listed),
          kind: initial.kind as (typeof partners.partnerKinds)[number],
          logo_path: (initial.logo_path as string | null) ?? null,
          name: { ar: initial.name_ar ?? "", en: initial.name_en },
          notes: String(initial.notes ?? ""),
          reach: initial.reach as (typeof partners.partnerReach)[number],
          slug: String(initial.slug ?? ""),
          status: initial.status as (typeof partners.partnerStatuses)[number],
          url: String(initial.url ?? ""),
        }
      : emptyPartner
  );
  const save = useMutation({
    mutationFn: async () => {
      const row = partners.partnerSchema.parse({
        contact_email: form.contact_email,
        contact_name: form.contact_name,
        contact_role: form.contact_role,
        description_ar: form.description.ar,
        description_en: form.description.en,
        is_listed: form.is_listed,
        kind: form.kind,
        logo_path: form.logo_path,
        name_ar: form.name.ar,
        name_en: form.name.en,
        notes: form.notes,
        reach: form.reach,
        slug: form.slug,
        status: form.status,
        url: form.url,
      });
      const table = supabase.schema("governance").from("partners");
      unwrap(
        initial
          ? await table.update(row).eq("id", initial.id)
          : await table.insert(row)
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
      <BilingualField
        label={t("name")}
        maxLength={200}
        onChange={(name) => setForm((f) => ({ ...f, name }))}
        required
        value={form.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field hint={t("slugHint")} label={t("slug")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              value={form.slug}
            />
          )}
        </Field>
        <Field label={t("url")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              type="url"
              value={form.url}
            />
          )}
        </Field>
        <Field label={t("kind")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as typeof form.kind,
                }))
              }
              value={form.kind}
            >
              {partners.partnerKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field hint={t("reachHint")} label={t("reach")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reach: e.target.value as typeof form.reach,
                }))
              }
              value={form.reach}
            >
              {partners.partnerReach.map((reach) => (
                <option key={reach} value={reach}>
                  {t(`reaches.${reach}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("status")}>
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
              {partners.partnerStatuses.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>
      <BilingualField
        label={t("description")}
        maxLength={1000}
        multiline
        onChange={(description) => setForm((f) => ({ ...f, description }))}
        value={form.description}
      />
      <ImageField
        area="partners"
        label={t("logo")}
        onChange={(logo_path) => setForm((f) => ({ ...f, logo_path }))}
        value={form.logo_path}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          checked={form.is_listed}
          id="partner-listed"
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, is_listed: checked === true }))
          }
        />
        <Label htmlFor="partner-listed">{t("listed")}</Label>
      </div>
      <p className="type-caption">{t("listedHint")}</p>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="type-kicker mb-2">{t("contact")}</legend>
        <Field label={t("contactName")}>
          {(id) => (
            <Input
              dir="auto"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_name: e.target.value }))
              }
              value={form.contact_name}
            />
          )}
        </Field>
        <Field label={t("contactRole")}>
          {(id) => (
            <Input
              dir="auto"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_role: e.target.value }))
              }
              value={form.contact_role}
            />
          )}
        </Field>
        <Field label={t("contactEmail")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
              type="email"
              value={form.contact_email}
            />
          )}
        </Field>
      </fieldset>
      <Field hint={t("notesHint")} label={t("notes")}>
        {(id) => (
          <Textarea
            dir="auto"
            id={id}
            maxLength={4000}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            value={form.notes}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <SaveButton pending={save.isPending} />
        <Button onClick={onDone} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
      <ErrorLine error={save.error} />
    </form>
  );
};

const Register = () => {
  const t = useTranslations("nexus.admin.partners.register");
  const locale = useLocale() as Locale;
  const register = usePartners();
  const [editing, setEditing] = useState<PartnerRow | "new" | null>(null);

  const columns: Column<PartnerRow>[] = [
    {
      cell: (row) => (
        <span className="font-medium">{localized(row, "name", locale)}</span>
      ),
      header: t("name"),
      key: "name",
    },
    {
      cell: (row) => t(`kinds.${row.kind as PartnerKind}`),
      header: t("kind"),
      key: "kind",
    },
    {
      cell: (row) => t(`reaches.${row.reach as PartnerReach}`),
      header: t("reach"),
      key: "reach",
    },
    {
      cell: (row) => t(`statuses.${row.status as PartnerStatus}`),
      header: t("status"),
      key: "status",
    },
    {
      cell: (row) => (row.is_listed ? t("yes") : t("no")),
      header: t("listedShort"),
      key: "listed",
    },
    {
      cell: (row) => (
        <Button onClick={() => setEditing(row)} size="sm" variant="outline">
          {t("edit")}
        </Button>
      ),
      header: "",
      key: "actions",
    },
  ];

  if (register.isPending) {
    return <SectionSpinner />;
  }

  return (
    <div className="grid gap-6">
      <p className="type-body">{t("lede")}</p>
      {editing ? (
        <PartnerForm
          initial={editing === "new" ? undefined : editing}
          key={editing === "new" ? "new" : editing.id}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button
          className="justify-self-start"
          onClick={() => setEditing("new")}
        >
          {t("add")}
        </Button>
      )}
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.id}
        rows={register.data ?? []}
      />
    </div>
  );
};

// ── Memoranda (Form F-26) ───────────────────────────────────────────────────

type AgreementRow = {
  code: string | null;
  ends_on: string | null;
  grants: string[];
  id: string;
  partner_id: string;
  purpose_en: string;
  renew_by: string | null;
  signed_at: string | null;
  starts_on: string;
  status: string;
  student_life_informed_on: string | null;
} & Record<string, unknown>;

const emptyAgreement = {
  branding: "",
  code: "",
  ends_on: "",
  grants: [] as (typeof partners.agreementGrants)[number][],
  money: "",
  partner_contact: "",
  partner_id: "",
  partner_will: "",
  people_safety: "",
  purpose: { ar: "", en: "" },
  renew_by: "",
  sal_contact: "",
  sal_will: "",
  starts_on: today(),
};

const AgreementForm = ({ onDone }: { onDone: () => void }) => {
  const t = useTranslations("nexus.admin.partners.agreements");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const register = usePartners();
  const [form, setForm] = useState(emptyAgreement);
  const save = useMutation({
    mutationFn: async () => {
      const row = partners.agreementSchema.parse({
        branding: form.branding,
        code: form.code,
        ends_on: form.ends_on,
        grants: form.grants,
        money: form.money,
        partner_contact: form.partner_contact,
        partner_id: form.partner_id,
        partner_will: form.partner_will,
        people_safety: form.people_safety,
        purpose_ar: form.purpose.ar,
        purpose_en: form.purpose.en,
        renew_by: form.renew_by,
        sal_contact: form.sal_contact,
        sal_will: form.sal_will,
        starts_on: form.starts_on,
      });
      unwrap(
        await supabase
          .schema("governance")
          .from("partner_agreements")
          .insert(row)
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      onDone();
    },
  });

  const text = (
    field: "sal_will" | "partner_will" | "money" | "branding" | "people_safety",
    hint?: string
  ) => (
    <Field hint={hint} label={t(`fields.${field}`)}>
      {(id) => (
        <Textarea
          dir="auto"
          id={id}
          maxLength={4000}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          rows={3}
          value={form[field]}
        />
      )}
    </Field>
  );

  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="type-caption">{t("formIntro")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.partner")}>
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
              {(register.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {localized(p, "name", locale)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field hint={t("codeHint")} label={t("fields.code")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              pattern="MOU-\d{4}-\d{2,3}"
              value={form.code}
            />
          )}
        </Field>
      </div>
      <BilingualField
        label={t("fields.purpose")}
        maxLength={2000}
        multiline
        onChange={(purpose) => setForm((f) => ({ ...f, purpose }))}
        required
        value={form.purpose}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {(["starts_on", "ends_on", "renew_by"] as const).map((field) => (
          <Field key={field} label={t(`fields.${field}`)}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field]: e.target.value }))
                }
                required={field === "starts_on"}
                type="date"
                value={form[field]}
              />
            )}
          </Field>
        ))}
      </div>
      {text("sal_will")}
      {text("partner_will")}
      {text("money", t("moneyHint"))}
      {text("branding", t("brandingHint"))}
      {text("people_safety", t("safetyHint"))}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["sal_contact", "partner_contact"] as const).map((field) => (
          <Field key={field} label={t(`fields.${field}`)}>
            {(id) => (
              <Input
                dir="auto"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field]: e.target.value }))
                }
                value={form[field]}
              />
            )}
          </Field>
        ))}
      </div>
      <fieldset className="grid gap-2">
        <legend className="type-kicker mb-1">{t("fields.grants")}</legend>
        <p className="type-caption">{t("grantsHint")}</p>
        {partners.agreementGrants.map((grant) => (
          <div className="flex items-center gap-2" key={grant}>
            <Checkbox
              checked={form.grants.includes(grant)}
              id={`grant-${grant}`}
              onCheckedChange={(checked) =>
                setForm((f) => ({
                  ...f,
                  grants:
                    checked === true
                      ? [...f.grants, grant]
                      : f.grants.filter((g) => g !== grant),
                }))
              }
            />
            <Label htmlFor={`grant-${grant}`}>{t(`grants.${grant}`)}</Label>
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <SaveButton pending={save.isPending} />
        <Button onClick={onDone} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
      <ErrorLine error={save.error} />
    </form>
  );
};

const SignForm = ({
  agreement,
  onDone,
}: {
  agreement: AgreementRow;
  onDone: () => void;
}) => {
  const t = useTranslations("nexus.admin.partners.agreements");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const fileId = useId();
  const [signatory, setSignatory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const sign = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("missing_file");
      }
      const stored = await uploadLibraryFile(supabase, "partners", file);
      await partners.signAgreement(
        supabase,
        agreement.id,
        signatory,
        stored.path
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      onDone();
    },
  });
  return (
    <form
      className="grid max-w-xl gap-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        sign.mutate();
      }}
    >
      <p className="type-caption">{t("signIntro")}</p>
      <Field label={t("partnerSignatory")}>
        {(id) => (
          <Input
            dir="auto"
            id={id}
            onChange={(e) => setSignatory(e.target.value)}
            required
            value={signatory}
          />
        )}
      </Field>
      <div className="grid gap-2">
        <Label htmlFor={fileId}>{t("signedCopy")}</Label>
        <Input
          accept="application/pdf"
          id={fileId}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          type="file"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={sign.isPending} type="submit">
          {t("sign")}
        </Button>
        <Button onClick={onDone} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
      <ErrorLine error={sign.error} />
    </form>
  );
};

const Agreements = () => {
  const t = useTranslations("nexus.admin.partners.agreements");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const partnerName = usePartnerNames();
  const canManage = hasPermissionAnywhere(grants.data, "partners.manage");
  const canSign = hasPermissionAnywhere(grants.data, "partners.sign");
  const [drafting, setDrafting] = useState(false);
  const [signing, setSigning] = useState<AgreementRow | null>(null);
  const agreements = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("partner_agreements")
          .select("*")
          .order("starts_on", { ascending: false })
      ) ?? []) as AgreementRow[],
    queryKey: [...key, "agreements"],
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        ended_on?: string;
        status?: "ended";
        student_life_informed_on?: string;
      };
    }) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("partner_agreements")
          .update(patch)
          .eq("id", id)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const open = async (id: string) => {
    const { url } = await callApi<{ url: string }>(
      supabase,
      "/files/agreement",
      { id }
    );
    window.open(url, "_blank", "noopener");
  };

  const rows = agreements.data ?? [];
  const due = partners.renewalsDue(rows);

  const columns: Column<AgreementRow>[] = [
    {
      cell: (row) => (
        <div className="grid">
          <span className="font-medium">{partnerName(row.partner_id)}</span>
          {row.code ? (
            <span className="type-caption" dir="ltr">
              {row.code}
            </span>
          ) : null}
        </div>
      ),
      header: t("fields.partner"),
      key: "partner",
    },
    {
      cell: (row) => (
        <span className="line-clamp-3" dir="auto">
          {localized(row, "purpose", locale)}
        </span>
      ),
      header: t("fields.purpose"),
      key: "purpose",
    },
    {
      cell: (row) =>
        `${formatLongDate(row.starts_on, locale, true)}${
          row.ends_on ? ` – ${formatLongDate(row.ends_on, locale, true)}` : ""
        }`,
      header: t("dates"),
      key: "dates",
    },
    {
      cell: (row) =>
        row.grants.length > 0
          ? row.grants
              .map((g) => t(`grants.${g as partners.AgreementGrant}`))
              .join(" · ")
          : t("noGrants"),
      header: t("fields.grants"),
      key: "grants",
    },
    {
      cell: (row) => t(`statuses.${row.status as AgreementStatus}`),
      header: t("status"),
      key: "status",
    },
    {
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === "draft" && canSign ? (
            <Button onClick={() => setSigning(row)} size="sm">
              {t("sign")}
            </Button>
          ) : null}
          {row.status !== "draft" && row.signed_document_path ? (
            <Button onClick={() => open(row.id)} size="sm" variant="outline">
              {t("openSigned")}
            </Button>
          ) : null}
          {row.status === "signed" &&
          canManage &&
          !row.student_life_informed_on ? (
            <Button
              onClick={() =>
                update.mutate({
                  id: row.id,
                  patch: { student_life_informed_on: today() },
                })
              }
              size="sm"
              variant="outline"
            >
              {t("informedStudentLife")}
            </Button>
          ) : null}
          {row.status === "signed" && canManage ? (
            <ConfirmAction
              confirmLabel={t("end")}
              description={t("endConfirm")}
              onConfirm={() =>
                update.mutate({
                  id: row.id,
                  patch: { ended_on: today(), status: "ended" },
                })
              }
            >
              {t("end")}
            </ConfirmAction>
          ) : null}
        </div>
      ),
      header: "",
      key: "actions",
    },
  ];

  if (agreements.isPending) {
    return <SectionSpinner />;
  }

  return (
    <div className="grid gap-6">
      <p className="type-body">{t("lede")}</p>
      {due.length > 0 ? (
        <SalCard>
          <h3 className="type-subheading">{t("renewalsDue")}</h3>
          <ul className="grid gap-1">
            {due.map((a) => (
              <li key={a.id}>
                {partnerName(a.partner_id)} ·{" "}
                {t("renewBy", {
                  date: formatLongDate(a.renew_by ?? "", locale, true),
                })}
              </li>
            ))}
          </ul>
        </SalCard>
      ) : null}
      {signing ? (
        <SignForm agreement={signing} onDone={() => setSigning(null)} />
      ) : null}
      {drafting ? <AgreementForm onDone={() => setDrafting(false)} /> : null}
      {!(drafting || signing) && canManage ? (
        <Button
          className="justify-self-start"
          onClick={() => setDrafting(true)}
        >
          {t("draft")}
        </Button>
      ) : null}
      <ErrorLine error={update.error} />
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.id}
        rows={rows}
      />
    </div>
  );
};

// ── Affiliations ────────────────────────────────────────────────────────────

interface AffiliationRow {
  created_at: string;
  id: string;
  note: string | null;
  partner_id: string;
  status: string;
  user_id: string;
}

const Affiliations = () => {
  const t = useTranslations("nexus.admin.partners.affiliations");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const partnerName = usePartnerNames();
  const affiliations = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("partner_affiliations")
          .select("id, partner_id, user_id, status, note, created_at")
          .order("created_at", { ascending: false })
      ) ?? []) as AffiliationRow[],
    queryKey: [...key, "affiliations"],
  });
  const rows = affiliations.data ?? [];
  const names = useMemberNames(rows.map((r) => r.user_id));
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("partner_affiliations")
          .update({ status })
          .eq("id", id)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const nameOf = (id: string) => {
    const row = names.data?.find((n) => n.id === id);
    return row ? memberName(row, locale) : "";
  };

  const affiliationActions = (row: AffiliationRow) => {
    if (row.status === "pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => decide.mutate({ id: row.id, status: "verified" })}
            size="sm"
          >
            {t("verify")}
          </Button>
          <Button
            onClick={() => decide.mutate({ id: row.id, status: "declined" })}
            size="sm"
            variant="outline"
          >
            {t("decline")}
          </Button>
        </div>
      );
    }
    if (row.status === "verified") {
      return (
        <Button
          onClick={() => decide.mutate({ id: row.id, status: "ended" })}
          size="sm"
          variant="outline"
        >
          {t("endAffiliation")}
        </Button>
      );
    }
    return null;
  };

  const columns: Column<AffiliationRow>[] = [
    { cell: (row) => nameOf(row.user_id), header: t("person"), key: "person" },
    {
      cell: (row) => partnerName(row.partner_id),
      header: t("partner"),
      key: "partner",
    },
    {
      cell: (row) => <span dir="auto">{row.note}</span>,
      header: t("note"),
      key: "note",
    },
    {
      cell: (row) => formatLongDate(row.created_at, locale, true),
      header: t("asked"),
      key: "asked",
    },
    {
      cell: (row) => t(`statuses.${row.status as AffiliationStatus}`),
      header: t("status"),
      key: "status",
    },
    {
      cell: (row) => affiliationActions(row),
      header: "",
      key: "actions",
    },
  ];

  if (affiliations.isPending) {
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

// ── Member offers ───────────────────────────────────────────────────────────

interface OfferRow {
  code: string | null;
  ends_on: string | null;
  id: string;
  is_published: boolean;
  partner_id: string;
  starts_on: string;
  title_ar: string | null;
  title_en: string;
}

const Offers = () => {
  const t = useTranslations("nexus.admin.partners.offers");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const register = usePartners();
  const partnerName = usePartnerNames();
  const empty = {
    code: "",
    details: { ar: "", en: "" },
    ends_on: "",
    is_published: false,
    partner_id: "",
    starts_on: today(),
    title: { ar: "", en: "" },
  };
  const [form, setForm] = useState(empty);
  const offers = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("member_offers")
          .select("*")
          .order("starts_on", { ascending: false })
      ) ?? []) as OfferRow[],
    queryKey: [...key, "offers"],
  });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("member_offers")
          .insert(
            partners.offerSchema.parse({
              code: form.code,
              details_ar: form.details.ar,
              details_en: form.details.en,
              ends_on: form.ends_on,
              is_published: form.is_published,
              partner_id: form.partner_id,
              starts_on: form.starts_on,
              title_ar: form.title.ar,
              title_en: form.title.en,
            })
          )
      ),
    onSuccess: async () => {
      setForm(empty);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const toggle = useMutation({
    mutationFn: async (row: OfferRow) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("member_offers")
          .update({ is_published: !row.is_published })
          .eq("id", row.id)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const columns: Column<OfferRow>[] = [
    {
      cell: (row) =>
        localized(
          { title_ar: row.title_ar, title_en: row.title_en },
          "title",
          locale
        ),
      header: t("offer"),
      key: "title",
    },
    {
      cell: (row) => partnerName(row.partner_id),
      header: t("partner"),
      key: "partner",
    },
    {
      cell: (row) =>
        `${formatLongDate(row.starts_on, locale, true)}${
          row.ends_on ? ` – ${formatLongDate(row.ends_on, locale, true)}` : ""
        }`,
      header: t("dates"),
      key: "dates",
    },
    {
      cell: (row) => (
        <Button onClick={() => toggle.mutate(row)} size="sm" variant="outline">
          {row.is_published ? t("unpublish") : t("publish")}
        </Button>
      ),
      header: t("published"),
      key: "published",
    },
  ];

  if (offers.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-6">
      <p className="type-body">{t("lede")}</p>
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="font-bold text-sm">{t("new")}</h3>
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
              {(register.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {localized(p, "name", locale)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <BilingualField
          label={t("title")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <BilingualField
          label={t("details")}
          maxLength={2000}
          multiline
          onChange={(details) => setForm((f) => ({ ...f, details }))}
          required
          value={form.details}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field hint={t("codeHint")} label={t("code")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                maxLength={60}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                value={form.code}
              />
            )}
          </Field>
          {(["starts_on", "ends_on"] as const).map((field) => (
            <Field key={field} label={t(field)}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  required={field === "starts_on"}
                  type="date"
                  value={form[field]}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.is_published}
            id="offer-published"
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, is_published: checked === true }))
            }
          />
          <Label htmlFor="offer-published">{t("publishNow")}</Label>
        </div>
        <p className="type-caption">{t("grantHint")}</p>
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error ?? toggle.error} />
      </form>
      <DataTable
        columns={columns}
        empty={t("empty")}
        rowKey={(row) => row.id}
        rows={offers.data ?? []}
      />
    </div>
  );
};

// ── Declarations received (Form F-18) ───────────────────────────────────────

interface DeclarationRow {
  conflict_items: {
    closed_on: string | null;
    id: string;
    kind: string;
    partner_id: string | null;
    what: string;
  }[];
  id: string;
  nothing_to_declare: boolean;
  received_at: string | null;
  role_title: string | null;
  signed_at: string;
  user_id: string;
}

const Declarations = () => {
  const t = useTranslations("nexus.admin.partners.declarations");
  const tKinds = useTranslations("nexus.declarations.kinds");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const partnerName = usePartnerNames();
  const grants = useGrants();
  const canReceive = hasPermissionAnywhere(grants.data, "governance.manage");
  const declarations = useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("conflict_declarations")
          .select(
            "id, user_id, role_title, nothing_to_declare, signed_at, received_at, conflict_items (id, kind, partner_id, what, closed_on)"
          )
          .order("signed_at", { ascending: false })
      ) ?? []) as DeclarationRow[],
    queryKey: [...key, "declarations"],
  });
  const rows = declarations.data ?? [];
  const names = useMemberNames(rows.map((r) => r.user_id));
  const receive = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("conflict_declarations")
          .update({ received_at: new Date().toISOString() })
          .eq("id", id)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const nameOf = (id: string) => {
    const row = names.data?.find((n) => n.id === id);
    return row ? memberName(row, locale) : "";
  };

  const receipt = (row: DeclarationRow) => {
    if (row.received_at) {
      return formatLongDate(row.received_at, locale, true);
    }
    if (!canReceive) {
      return t("notReceived");
    }
    return (
      <Button onClick={() => receive.mutate(row.id)} size="sm">
        {t("receive")}
      </Button>
    );
  };

  const columns: Column<DeclarationRow>[] = [
    {
      cell: (row) => (
        <div className="grid">
          <span className="font-medium">{nameOf(row.user_id)}</span>
          <span className="type-caption" dir="auto">
            {row.role_title}
          </span>
        </div>
      ),
      header: t("person"),
      key: "person",
    },
    {
      cell: (row) =>
        row.nothing_to_declare ? (
          t("nothing")
        ) : (
          <ul className="grid gap-1">
            {row.conflict_items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">
                  {tKinds(item.kind as ConflictKind)}
                </span>
                {item.partner_id ? ` · ${partnerName(item.partner_id)}` : ""}
                {": "}
                <span dir="auto">{item.what}</span>
                {item.closed_on ? ` (${t("closed")})` : ""}
              </li>
            ))}
          </ul>
        ),
      header: t("declared"),
      key: "declared",
    },
    {
      cell: (row) => formatLongDate(row.signed_at, locale, true),
      header: t("signed"),
      key: "signed",
    },
    {
      cell: (row) => receipt(row),
      header: t("received"),
      key: "received",
    },
  ];

  if (declarations.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-4">
      <p className="type-body">{t("lede")}</p>
      <ErrorLine error={receive.error} />
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

export const PartnersAdmin = () => {
  const t = useTranslations("nexus.admin.partners");
  const grants = useGrants();
  const canManage = hasPermissionAnywhere(grants.data, "partners.manage");
  const canSeeDeclarations =
    hasPermissionAnywhere(grants.data, "governance.manage") ||
    hasPermissionAnywhere(grants.data, "partners.sign");

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue={canManage ? "register" : "agreements"}>
        <TabsList className="flex-wrap">
          {canManage ? (
            <TabsTrigger value="register">{t("tabs.register")}</TabsTrigger>
          ) : null}
          <TabsTrigger value="agreements">{t("tabs.agreements")}</TabsTrigger>
          {canManage ? (
            <TabsTrigger value="affiliations">
              {t("tabs.affiliations")}
            </TabsTrigger>
          ) : null}
          {canManage ? (
            <TabsTrigger value="offers">{t("tabs.offers")}</TabsTrigger>
          ) : null}
          {canSeeDeclarations ? (
            <TabsTrigger value="declarations">
              {t("tabs.declarations")}
            </TabsTrigger>
          ) : null}
        </TabsList>
        {canManage ? (
          <TabsContent className="pt-4" value="register">
            <Register />
          </TabsContent>
        ) : null}
        <TabsContent className="pt-4" value="agreements">
          <Agreements />
        </TabsContent>
        {canManage ? (
          <TabsContent className="pt-4" value="affiliations">
            <Affiliations />
          </TabsContent>
        ) : null}
        {canManage ? (
          <TabsContent className="pt-4" value="offers">
            <Offers />
          </TabsContent>
        ) : null}
        {canSeeDeclarations ? (
          <TabsContent className="pt-4" value="declarations">
            <Declarations />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
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
import type { Locale } from "@repo/internationalization";
import {
  formatIqd,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { hasPermission } from "@repo/rbac";
import { charity, localized, unwrap } from "@repo/sal-data";
import { removeFiles, uploadReceipt } from "@repo/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { callApi } from "@/lib/api";
import { useGrants } from "@/lib/queries";
import { useQueryParam } from "@/lib/use-query-param";
import { ErrorState, SectionSpinner } from "../../states";
import { useProgrammeOptions } from "../events/data";
import { slugify } from "../events/editor";
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
import { MemberPicker, useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const DEFAULT_COST_IQD = 40_000;

/** A key for a form row that has no id yet. */
const rowKey = () => Math.random().toString(36).slice(2, 10);

interface PriceItem {
  iqd: number[];
  label_ar: string;
  label_en: string;
}

const asPriceList = (value: unknown): PriceItem[] =>
  Array.isArray(value) ? (value as PriceItem[]) : [];

const parsePrices = (value: string) =>
  value
    .split(",")
    .map((part) => Number(part.replaceAll(/[^0-9]/g, "")))
    .filter((n) => Number.isInteger(n) && n > 0);

// ── Settings ────────────────────────────────────────────────────────────────

const CampaignSettings = ({ campaignId }: { campaignId: string | null }) => {
  const t = useTranslations("nexus.admin.charity");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const programmes = useProgrammeOptions(null);
  const [form, setForm] = useState({
    cost: "",
    ends_on: "",
    partner_id: "",
    prices: [] as {
      key: string;
      label: { ar: string; en: string };
      prices: string;
    }[],
    programme_id: "",
    slug: "",
    starts_on: "",
    status: "draft",
    summary: { ar: "", en: "" },
    target: "",
    title: { ar: "", en: "" },
    unit: { ar: "أطفال كُسوا", en: "children clothed" },
  });

  const existing = useQuery({
    enabled: Boolean(campaignId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("campaigns")
          .select("*")
          .eq("id", campaignId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "campaign", campaignId],
  });
  const partners = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("partners")
          .select("id, name_en, name_ar")
      ) ?? [],
    queryKey: ["admin", "partners"],
  });
  const setting = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("settings")
          .select("value")
          .eq("key", "charity.cost_per_winter_set_iqd")
          .maybeSingle()
      ),
    queryKey: ["admin", "setting", "charity.cost_per_winter_set_iqd"],
  });

  useEffect(() => {
    const c = existing.data;
    if (c) {
      setForm({
        cost: c.cost_per_unit_iqd ? String(c.cost_per_unit_iqd) : "",
        ends_on: c.ends_on ?? "",
        partner_id: c.partner_id ?? "",
        prices: asPriceList(c.price_list).map((p) => ({
          key: rowKey(),
          label: { ar: p.label_ar, en: p.label_en },
          prices: p.iqd.join(", "),
        })),
        programme_id: c.programme_id ?? "",
        slug: c.slug,
        starts_on: c.starts_on ?? "",
        status: c.status,
        summary: { ar: c.summary_ar ?? "", en: c.summary_en ?? "" },
        target: c.target_units ? String(c.target_units) : "",
        title: { ar: c.title_ar, en: c.title_en },
        unit: { ar: c.unit_label_ar, en: c.unit_label_en },
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        cost_per_unit_iqd: form.cost ? Number(form.cost) : null,
        ends_on: form.ends_on || null,
        partner_id: form.partner_id || null,
        price_list: form.prices
          .filter((p) => p.label.en.trim() || p.label.ar.trim())
          .map((p) => ({
            iqd: parsePrices(p.prices),
            label_ar: p.label.ar,
            label_en: p.label.en,
          })),
        programme_id: form.programme_id || null,
        slug: form.slug || slugify(form.title.en),
        starts_on: form.starts_on || null,
        status: form.status,
        summary_ar: form.summary.ar || null,
        summary_en: form.summary.en || null,
        target_units: form.target ? Number(form.target) : null,
        title_ar: form.title.ar,
        title_en: form.title.en,
        unit_label_ar: form.unit.ar,
        unit_label_en: form.unit.en,
      };
      const table = supabase.schema("charity").from("campaigns");
      if (campaignId) {
        unwrap(await table.update(row).eq("id", campaignId));
        return campaignId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (!campaignId) {
        router.replace({
          pathname: "/admin/charity/campaign",
          query: { id: savedId },
        });
      }
    },
  });

  if (campaignId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (campaignId && !existing.data) {
    return (
      <p className="type-body text-text-secondary">{t("campaign.notFound")}</p>
    );
  }

  const defaultCost =
    Number(setting.data?.value ?? DEFAULT_COST_IQD) || DEFAULT_COST_IQD;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form className="grid max-w-4xl gap-6" onSubmit={submit}>
      <BilingualField
        label={t("campaign.titleField")}
        maxLength={200}
        onChange={(title) => setForm((f) => ({ ...f, title }))}
        required
        value={form.title}
      />
      <Field hint={tk("slugHint")} label={tk("slug")}>
        {(id) => (
          <Input
            dir="ltr"
            id={id}
            maxLength={80}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder={slugify(form.title.en)}
            value={form.slug}
          />
        )}
      </Field>
      <BilingualField
        label={t("campaign.summary")}
        maxLength={600}
        multiline
        onChange={(summary) => setForm((f) => ({ ...f, summary }))}
        rows={3}
        value={form.summary}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("campaign.partner")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, partner_id: e.target.value }))
              }
              value={form.partner_id}
            >
              <option value="">{t("campaign.noPartner")}</option>
              {partners.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {localized(p, "name", locale)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={tk("programme")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
              value={form.programme_id}
            >
              <option value="">{tk("noProgramme")}</option>
              {programmes.options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("campaign.startsOn")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, starts_on: e.target.value }))
              }
              type="date"
              value={form.starts_on}
            />
          )}
        </Field>
        <Field label={t("campaign.endsOn")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, ends_on: e.target.value }))
              }
              type="date"
              value={form.ends_on}
            />
          )}
        </Field>
        <Field
          hint={t("campaign.costPlaceholder", {
            amount: formatIqd(defaultCost, locale),
          })}
          label={t("campaign.costPerUnit")}
        >
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              inputMode="numeric"
              min={1}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              type="number"
              value={form.cost}
            />
          )}
        </Field>
        <Field label={t("campaign.target")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              inputMode="numeric"
              min={1}
              onChange={(e) =>
                setForm((f) => ({ ...f, target: e.target.value }))
              }
              type="number"
              value={form.target}
            />
          )}
        </Field>
      </div>
      <BilingualField
        label={t("campaign.unitLabel")}
        maxLength={80}
        onChange={(unit) => setForm((f) => ({ ...f, unit }))}
        required
        value={form.unit}
      />
      <fieldset className="grid gap-3">
        <legend className="type-subheading">{t("campaign.priceList")}</legend>
        <p className="type-caption">{t("campaign.priceListHint")}</p>
        {form.prices.map((item, index) => (
          <div
            className="grid gap-3 rounded-card bg-surface-tint p-card-padding"
            key={item.key}
          >
            <BilingualField
              label={t("campaign.priceItem")}
              maxLength={80}
              onChange={(label) =>
                setForm((f) => ({
                  ...f,
                  prices: f.prices.map((p, i) =>
                    i === index ? { ...p, label } : p
                  ),
                }))
              }
              value={item.label}
            />
            <Field label={t("campaign.prices")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      prices: f.prices.map((p, i) =>
                        i === index ? { ...p, prices: e.target.value } : p
                      ),
                    }))
                  }
                  value={item.prices}
                />
              )}
            </Field>
            <Button
              className="justify-self-start"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  prices: f.prices.filter((_, i) => i !== index),
                }))
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("campaign.removePrice")}
            </Button>
          </div>
        ))}
        <Button
          className="justify-self-start"
          onClick={() =>
            setForm((f) => ({
              ...f,
              prices: [
                ...f.prices,
                { key: rowKey(), label: { ar: "", en: "" }, prices: "" },
              ],
            }))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {t("campaign.addPrice")}
        </Button>
      </fieldset>
      <Field label={t("campaign.status")}>
        {(id) => (
          <SelectInput
            className="w-48"
            id={id}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            value={form.status}
          >
            {(["draft", "active", "closed"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <SaveButton pending={save.isPending} success={save.isSuccess} />
      <ErrorLine error={save.error} />
    </form>
  );
};

// ── Ledger ──────────────────────────────────────────────────────────────────

const useLedger = (campaignId: string) => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const [entries, signoffs] = await Promise.all([
        supabase
          .schema("charity")
          .from("ledger_entries")
          .select(
            "id, occurred_on, amount_iqd, source, counted_by, counted_with, created_by, note, reverses_entry_id, created_at"
          )
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false }),
        supabase
          .schema("charity")
          .from("ledger_signoffs")
          .select("entry_id, signed_by, signed_at"),
      ]);
      const signoffRows = unwrap(signoffs) ?? [];
      const entryRows = unwrap(entries) ?? [];
      return entryRows.map((e) => ({
        ...e,
        reversed: entryRows.some((other) => other.reverses_entry_id === e.id),
        signoff: signoffRows.find((s) => s.entry_id === e.id) ?? null,
      }));
    },
    queryKey: ["admin", "ledger", campaignId],
  });
};

type LedgerRow = NonNullable<ReturnType<typeof useLedger>["data"]>[number];

const Ledger = ({ campaignId, slug }: { campaignId: string; slug: string }) => {
  const t = useTranslations("nexus.admin.charity");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const canWrite = hasPermission(
    grants.data,
    "charity.ledger.write",
    "campaign",
    campaignId
  );
  const ledger = useLedger(campaignId);
  const names = useMemberNames(
    (ledger.data ?? []).flatMap((e) => [
      e.counted_by,
      e.counted_with,
      e.signoff?.signed_by,
    ])
  );
  const me = useMemberNames([user?.id]);
  const [form, setForm] = useState({
    amount: "",
    counted_with: null as {
      full_name_ar: string | null;
      full_name_en: string;
      id: string;
    } | null,
    note: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    source: "table_cash" as (typeof charity.ledgerSources)[number],
  });
  const [problem, setProblem] = useState<string | null>(null);

  const nameOf = (id: string | null | undefined) => {
    const p = names.data?.find((n) => n.id === id);
    return p ? memberName(p, locale) : "—";
  };
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin"] });

  const record = useMutation({
    mutationFn: async () => {
      const parsed = charity.ledgerEntrySchema.safeParse({
        amount_iqd: Number(form.amount),
        campaign_id: campaignId,
        counted_by: user?.id,
        counted_with: form.counted_with?.id,
        note: form.note.trim() || undefined,
        occurred_on: form.occurred_on,
        source: form.source,
      });
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        setProblem(
          issue?.message === "two_counters"
            ? t("ledger.twoCounters")
            : t("ledger.amountError")
        );
        throw new Error("invalid");
      }
      setProblem(null);
      unwrap(
        await supabase
          .schema("charity")
          .from("ledger_entries")
          .insert(parsed.data)
      );
    },
    onSuccess: async () => {
      setForm((f) => ({ ...f, amount: "", counted_with: null, note: "" }));
      await invalidate();
    },
  });
  const reverse = useMutation({
    mutationFn: async (entry: LedgerRow) =>
      unwrap(
        await supabase
          .schema("charity")
          .from("ledger_entries")
          .insert({
            amount_iqd: -entry.amount_iqd,
            campaign_id: campaignId,
            counted_by: user?.id ?? "",
            counted_with:
              entry.counted_by === user?.id
                ? entry.counted_with
                : entry.counted_by,
            note: t("ledger.reversal"),
            occurred_on: new Date().toISOString().slice(0, 10),
            reverses_entry_id: entry.id,
            source: entry.source,
          })
      ),
    onSuccess: invalidate,
  });

  const columns: Column<LedgerRow>[] = [
    {
      cell: (e) => formatLongDate(e.occurred_on, locale, true),
      className: "whitespace-nowrap",
      header: t("columns.date"),
      key: "date",
    },
    {
      cell: (e) => formatIqd(e.amount_iqd, locale),
      className: "whitespace-nowrap tabular-nums text-end",
      header: t("columns.amount"),
      key: "amount",
    },
    {
      cell: (e) => t(`sources.${e.source}`),
      header: t("columns.source"),
      key: "source",
    },
    {
      cell: (e) => `${nameOf(e.counted_by)} · ${nameOf(e.counted_with)}`,
      header: t("columns.countedBy"),
      key: "counted",
    },
    {
      cell: (e) =>
        e.signoff
          ? `${nameOf(e.signoff.signed_by)}, ${formatLongDate(e.signoff.signed_at, locale)}`
          : t("ledger.waiting"),
      header: t("columns.signedOff"),
      key: "signoff",
    },
    {
      cell: (e) =>
        e.reverses_entry_id ? t("ledger.reversal") : (e.note ?? ""),
      header: t("columns.note"),
      key: "note",
    },
    {
      cell: (e) => {
        if (e.reversed) {
          return t("ledger.reversed");
        }
        return canWrite && !e.reverses_entry_id ? (
          <ConfirmAction
            confirmLabel={t("ledger.reverse")}
            description={t("ledger.reverseConfirm", {
              amount: formatIqd(-e.amount_iqd, locale),
            })}
            disabled={reverse.isPending}
            onConfirm={() => reverse.mutate(e)}
            variant="ghost"
          >
            {t("ledger.reverse")}
          </ConfirmAction>
        ) : null;
      },
      header: "",
      key: "actions",
    },
  ];

  const submit = (event: FormEvent) => event.preventDefault();
  const myName = me.data?.[0] ? memberName(me.data[0], locale) : t("ledger.me");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="type-body text-text-secondary">{t("ledger.lede")}</p>
        <ExportButton
          fileName={`sal-ledger-${slug}.csv`}
          name="ledger"
          params={{ campaign_id: campaignId }}
        />
      </div>
      {ledger.isPending ? <SectionSpinner /> : null}
      {ledger.data ? (
        <DataTable columns={columns} rowKey={(e) => e.id} rows={ledger.data} />
      ) : null}
      {canWrite ? (
        <form className="grid max-w-3xl gap-4" onSubmit={submit}>
          <h3 className="type-subheading">{t("ledger.record")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("ledger.amount")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  inputMode="numeric"
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
            <Field label={t("ledger.source")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      source: e.target
                        .value as (typeof charity.ledgerSources)[number],
                    }))
                  }
                  value={form.source}
                >
                  {charity.ledgerSources.map((s) => (
                    <option key={s} value={s}>
                      {t(`sources.${s}`)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label={t("ledger.occurredOn")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, occurred_on: e.target.value }))
                  }
                  required
                  type="date"
                  value={form.occurred_on}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <span className="font-medium text-sm">
                {t("ledger.countedBy")}
              </span>
              <span>{myName}</span>
              <span className="type-caption">{t("ledger.countedHint")}</span>
            </div>
            <MemberPicker
              excludeId={user?.id}
              label={t("ledger.countedWith")}
              onChange={(counted_with) =>
                setForm((f) => ({ ...f, counted_with }))
              }
              value={form.counted_with}
            />
          </div>
          <Field label={t("ledger.note")}>
            {(id) => (
              <Input
                id={id}
                maxLength={1000}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                value={form.note}
              />
            )}
          </Field>
          {problem ? (
            <p className="text-sm text-title" role="alert">
              {problem}
            </p>
          ) : null}
          <div>
            <ConfirmAction
              confirmLabel={t("ledger.recordButton")}
              description={t("ledger.recordConfirm", {
                a: myName,
                amount: formatIqd(Number(form.amount) || 0, locale),
                b: form.counted_with
                  ? memberName(form.counted_with, locale)
                  : "—",
              })}
              disabled={!(form.amount && form.counted_with) || record.isPending}
              onConfirm={() => record.mutate()}
              variant="default"
            >
              {t("ledger.recordButton")}
            </ConfirmAction>
          </div>
          {record.error && record.error.message !== "invalid" ? (
            <ErrorLine error={record.error} />
          ) : null}
          <ErrorLine error={reverse.error} />
        </form>
      ) : null}
    </div>
  );
};

// ── Sign-off queue ──────────────────────────────────────────────────────────

const SignoffQueue = ({ campaignId }: { campaignId: string }) => {
  const t = useTranslations("nexus.admin.charity");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const ledger = useLedger(campaignId);
  const waiting = (ledger.data ?? []).filter(
    (e) => !e.signoff && e.created_by !== user?.id
  );
  const names = useMemberNames(
    waiting.flatMap((e) => [e.created_by, e.counted_by, e.counted_with])
  );
  const nameOf = (id: string) => {
    const p = names.data?.find((n) => n.id === id);
    return p ? memberName(p, locale) : "—";
  };
  const sign = useMutation({
    mutationFn: async (entryId: string) =>
      unwrap(
        await supabase
          .schema("charity")
          .from("ledger_signoffs")
          .insert({ entry_id: entryId })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (ledger.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-4">
      <p className="type-body text-text-secondary">{t("signoff.lede")}</p>
      {waiting.length === 0 ? (
        <p className="type-body text-text-secondary">{t("signoff.empty")}</p>
      ) : null}
      <ul className="grid gap-3">
        {waiting.map((e) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 border-rule border-b pb-3"
            key={e.id}
          >
            <div>
              <p className="font-bold tabular-nums">
                {formatIqd(e.amount_iqd, locale)} · {t(`sources.${e.source}`)}
              </p>
              <p className="type-caption">
                {formatLongDate(e.occurred_on, locale, true)} ·{" "}
                {`${nameOf(e.counted_by)} · ${nameOf(e.counted_with)}`} ·{" "}
                {t("signoff.recordedBy", { name: nameOf(e.created_by) })}
              </p>
              {e.note ? <p className="type-caption">{e.note}</p> : null}
            </div>
            <ConfirmAction
              confirmLabel={t("signoff.sign")}
              description={t("signoff.signConfirm", {
                amount: formatIqd(e.amount_iqd, locale),
              })}
              disabled={sign.isPending}
              onConfirm={() => sign.mutate(e.id)}
              variant="default"
            >
              {t("signoff.sign")}
            </ConfirmAction>
          </li>
        ))}
      </ul>
      <ErrorLine error={sign.error} />
    </div>
  );
};

// ── Receipts ────────────────────────────────────────────────────────────────

const Receipts = ({ campaignId }: { campaignId: string }) => {
  const t = useTranslations("nexus.admin.charity");
  const tm = useTranslations("nexus.admin.members");
  const locale = useLocale() as Locale;
  const id = useId();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    amount: "",
    description: { ar: "", en: "" },
    is_public: false,
  });
  const receipts = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("receipts")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false })
      ) ?? [],
    queryKey: ["admin", "receipts", campaignId],
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "receipts"] });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) {
        return;
      }
      const stored = await uploadReceipt(supabase, campaignId, file);
      unwrap(
        await supabase
          .schema("charity")
          .from("receipts")
          .insert({
            amount_iqd: form.amount ? Number(form.amount) : null,
            campaign_id: campaignId,
            description_ar: form.description.ar || null,
            description_en: form.description.en,
            is_public: form.is_public,
            storage_path: stored.path,
          })
      );
    },
    onSuccess: async () => {
      setFile(null);
      setForm({
        amount: "",
        description: { ar: "", en: "" },
        is_public: false,
      });
      await invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: async (receipt: { id: string; is_public: boolean }) =>
      unwrap(
        await supabase
          .schema("charity")
          .from("receipts")
          .update({ is_public: !receipt.is_public })
          .eq("id", receipt.id)
      ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (receipt: { id: string; storage_path: string }) => {
      await removeFiles(supabase, "receipts", [receipt.storage_path]);
      unwrap(
        await supabase
          .schema("charity")
          .from("receipts")
          .delete()
          .eq("id", receipt.id)
      );
    },
    onSuccess: invalidate,
  });
  const view = async (receiptId: string) => {
    const { url } = await callApi<{ url: string }>(supabase, "/files/receipt", {
      id: receiptId,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  type Row = NonNullable<typeof receipts.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (r) => localized(r, "description", locale),
      header: t("columns.description"),
      key: "description",
    },
    {
      cell: (r) => (r.amount_iqd ? formatIqd(r.amount_iqd, locale) : "—"),
      className: "whitespace-nowrap tabular-nums",
      header: t("columns.amount"),
      key: "amount",
    },
    {
      cell: (r) => (r.is_public ? tm("yes") : tm("no")),
      header: t("columns.public"),
      key: "public",
    },
    {
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => view(r.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("receipts.view")}
          </Button>
          <Button
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(r)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {r.is_public ? t("receipts.makePrivate") : t("receipts.makePublic")}
          </Button>
          <ConfirmAction
            confirmLabel={t("receipts.remove")}
            description={t("receipts.removeConfirm")}
            disabled={remove.isPending}
            onConfirm={() => remove.mutate(r)}
            variant="ghost"
          >
            {t("receipts.remove")}
          </ConfirmAction>
        </div>
      ),
      header: "",
      key: "actions",
    },
  ];

  return (
    <div className="grid gap-6">
      <p className="type-body text-text-secondary">{t("receipts.lede")}</p>
      {receipts.data ? (
        <DataTable
          columns={columns}
          rowKey={(r) => r.id}
          rows={receipts.data}
        />
      ) : null}
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          upload.mutate();
        }}
      >
        <h3 className="type-subheading">{t("receipts.upload")}</h3>
        <Field hint={t("receipts.noPhotos")} label={t("receipts.file")}>
          {(fieldId) => (
            <Input
              accept="application/pdf,image/jpeg,image/png"
              id={fieldId}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              type="file"
            />
          )}
        </Field>
        <BilingualField
          label={t("receipts.description")}
          maxLength={300}
          onChange={(description) => setForm((f) => ({ ...f, description }))}
          value={form.description}
        />
        <Field label={t("receipts.amount")}>
          {(fieldId) => (
            <Input
              className="w-48"
              dir="ltr"
              id={fieldId}
              inputMode="numeric"
              min={1}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              type="number"
              value={form.amount}
            />
          )}
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.is_public}
            id={`${id}-public`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, is_public: v === true }))
            }
          />
          <Label htmlFor={`${id}-public`}>{t("receipts.public")}</Label>
        </div>
        <SaveButton
          disabled={!(file && form.description.en.trim())}
          pending={upload.isPending}
        />
        <ErrorLine error={upload.error ?? toggle.error ?? remove.error} />
      </form>
    </div>
  );
};

// ── Impact ──────────────────────────────────────────────────────────────────

const Impact = ({ campaignId }: { campaignId: string }) => {
  const t = useTranslations("nexus.admin.charity.impact");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    label: { ar: "", en: "" },
    report: { ar: "", en: "" },
    unit: { ar: "", en: "" },
    value: "",
  });
  const metrics = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("impact_metrics")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("sort")
      ) ?? [],
    queryKey: ["admin", "impact", campaignId],
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "impact"] });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("impact_metrics")
          .insert({
            campaign_id: campaignId,
            label_ar: form.label.ar,
            label_en: form.label.en,
            report_ar: form.report.ar || null,
            report_en: form.report.en || null,
            sort: metrics.data?.length ?? 0,
            unit_ar: form.unit.ar || null,
            unit_en: form.unit.en || null,
            value: Number(form.value),
          })
      ),
    onSuccess: async () => {
      setForm({
        label: { ar: "", en: "" },
        report: { ar: "", en: "" },
        unit: { ar: "", en: "" },
        value: "",
      });
      await invalidate();
    },
  });
  const publish = useMutation({
    mutationFn: async (metric: { id: string; published_at: string | null }) =>
      unwrap(
        await supabase
          .schema("charity")
          .from("impact_metrics")
          .update({
            published_at: metric.published_at ? null : new Date().toISOString(),
          })
          .eq("id", metric.id)
      ),
    onSuccess: invalidate,
  });

  return (
    <div className="grid gap-6">
      <p className="type-body text-text-secondary">{t("lede")}</p>
      <ul className="grid gap-3">
        {metrics.data?.map((m) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 border-rule border-b pb-3"
            key={m.id}
          >
            <div>
              <p className="font-bold">
                {formatNumber(m.value)} {localized(m, "unit", locale)}
              </p>
              <p className="type-caption">{localized(m, "label", locale)}</p>
            </div>
            <div className="flex items-center gap-3">
              {m.published_at ? (
                <span className="type-caption">{t("published")}</span>
              ) : null}
              <ConfirmAction
                confirmLabel={m.published_at ? t("unpublish") : t("publish")}
                description={localized(m, "label", locale)}
                disabled={publish.isPending}
                onConfirm={() => publish.mutate(m)}
              >
                {m.published_at ? t("unpublish") : t("publish")}
              </ConfirmAction>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("add")}</h3>
        <BilingualField
          label={t("label")}
          maxLength={200}
          onChange={(label) => setForm((f) => ({ ...f, label }))}
          required
          value={form.label}
        />
        <Field label={t("value")}>
          {(id) => (
            <Input
              className="w-48"
              dir="ltr"
              id={id}
              inputMode="decimal"
              onChange={(e) =>
                setForm((f) => ({ ...f, value: e.target.value }))
              }
              required
              type="number"
              value={form.value}
            />
          )}
        </Field>
        <BilingualField
          label={t("unit")}
          maxLength={60}
          onChange={(unit) => setForm((f) => ({ ...f, unit }))}
          value={form.unit}
        />
        <BilingualField
          label={t("report")}
          multiline
          onChange={(report) => setForm((f) => ({ ...f, report }))}
          rows={4}
          value={form.report}
        />
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error ?? publish.error} />
      </form>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const CampaignAdmin = () => {
  const t = useTranslations("nexus.admin.charity");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const campaignId = useQueryParam("id");
  const { supabase, user } = useAuth();
  const grants = useGrants();
  const campaign = useQuery({
    enabled: Boolean(campaignId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("campaigns")
          .select("id, slug, title_en, title_ar")
          .eq("id", campaignId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "campaign-head", campaignId],
  });
  const ledger = useQuery({
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const entries =
        unwrap(
          await supabase
            .schema("charity")
            .from("ledger_entries")
            .select("id, created_by")
            .eq("campaign_id", campaignId ?? "")
        ) ?? [];
      const signoffs =
        unwrap(
          await supabase
            .schema("charity")
            .from("ledger_signoffs")
            .select("entry_id")
        ) ?? [];
      return entries.filter(
        (e) =>
          e.created_by !== user?.id &&
          !signoffs.some((s) => s.entry_id === e.id)
      ).length;
    },
    queryKey: ["admin", "ledger-waiting", campaignId],
  });

  const back = (
    <Link
      className="text-sm underline underline-offset-4"
      href="/admin/charity"
    >
      {tk("back")}
    </Link>
  );

  if (!campaignId) {
    return (
      <div className="grid gap-8">
        <AdminHeading actions={back} title={t("newCampaign")} />
        <CampaignSettings campaignId={null} />
      </div>
    );
  }
  if (campaign.isPending) {
    return <SectionSpinner />;
  }
  if (campaign.isError) {
    return <ErrorState onRetry={() => campaign.refetch()} />;
  }
  if (!campaign.data) {
    return (
      <p className="type-body text-text-secondary">{t("campaign.notFound")}</p>
    );
  }

  const can = (
    permission:
      | "charity.manage"
      | "charity.ledger.write"
      | "charity.ledger.signoff"
  ) => hasPermission(grants.data, permission, "campaign", campaignId);
  const canManage = can("charity.manage");
  const canSign = can("charity.ledger.signoff");

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={back}
        title={localized(campaign.data, "title", locale)}
      />
      <Tabs defaultValue="ledger">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ledger">{t("tabs.ledger")}</TabsTrigger>
          {canSign ? (
            <TabsTrigger value="signoff">
              {t("tabs.signoff", { count: formatNumber(ledger.data ?? 0) })}
            </TabsTrigger>
          ) : null}
          {canManage ? (
            <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
          ) : null}
          {canManage ? (
            <TabsTrigger value="receipts">{t("tabs.receipts")}</TabsTrigger>
          ) : null}
          {canManage ? (
            <TabsTrigger value="impact">{t("tabs.impact")}</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent className="pt-4" value="ledger">
          <Ledger campaignId={campaignId} slug={campaign.data.slug} />
        </TabsContent>
        {canSign ? (
          <TabsContent className="pt-4" value="signoff">
            <SignoffQueue campaignId={campaignId} />
          </TabsContent>
        ) : null}
        {canManage ? (
          <>
            <TabsContent className="pt-4" value="settings">
              <CampaignSettings campaignId={campaignId} />
            </TabsContent>
            <TabsContent className="pt-4" value="receipts">
              <Receipts campaignId={campaignId} />
            </TabsContent>
            <TabsContent className="pt-4" value="impact">
              <Impact campaignId={campaignId} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
};

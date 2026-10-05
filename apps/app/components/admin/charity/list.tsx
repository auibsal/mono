"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import { formatIqd, formatNumber } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermission } from "@repo/rbac";
import { charity, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import { slugify } from "../events/editor";
import { ImageField } from "../image-field";
import {
  AdminHeading,
  BilingualField,
  type Column,
  DataTable,
  ErrorLine,
  Field,
  SaveButton,
} from "../kit";

export const useCampaigns = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const [campaigns, progress] = await Promise.all([
        supabase
          .schema("charity")
          .from("campaigns")
          .select(
            "id, slug, title_en, title_ar, status, starts_on, target_units"
          )
          .order("created_at", { ascending: false }),
        charity.campaignProgress(supabase),
      ]);
      return (unwrap(campaigns) ?? []).map((c) => ({
        ...c,
        progress: progress.find((p) => p.campaign_id === c.id),
      }));
    },
    queryKey: ["admin", "campaigns"],
  });
};

interface PartnerForm {
  description: { ar: string; en: string };
  id: string | null;
  logo_path: string | null;
  name: { ar: string; en: string };
  url: string;
}

const blankPartner: PartnerForm = {
  description: { ar: "", en: "" },
  id: null,
  logo_path: null,
  name: { ar: "", en: "" },
  url: "",
};

const Partners = () => {
  const t = useTranslations("nexus.admin.charity");
  const tk = useTranslations("nexus.admin.kit");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PartnerForm>(blankPartner);
  const partners = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("charity")
          .from("partners")
          .select("*")
          .order("name_en")
      ) ?? [],
    queryKey: ["admin", "partners"],
  });
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        description_ar: form.description.ar || null,
        description_en: form.description.en || null,
        logo_path: form.logo_path,
        name_ar: form.name.ar,
        name_en: form.name.en,
        slug: slugify(form.name.en),
        url: form.url.trim() || null,
      };
      const table = supabase.schema("charity").from("partners");
      unwrap(
        form.id
          ? await table.update(row).eq("id", form.id)
          : await table.insert(row)
      );
    },
    onSuccess: async () => {
      setForm(blankPartner);
      await queryClient.invalidateQueries({ queryKey: ["admin", "partners"] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <section className="grid gap-4">
      <h2 className="type-heading">{t("partners")}</h2>
      <ul className="grid gap-2">
        {partners.data?.map((p) => (
          <li className="flex flex-wrap items-center gap-3" key={p.id}>
            <span className="font-medium">
              {/* Arabic-named partners are named in Arabic first (brand book). */}
              <span lang="ar">{p.name_ar}</span> ·{" "}
              <span lang="en">{p.name_en}</span>
            </span>
            <Button
              onClick={() =>
                setForm({
                  description: {
                    ar: p.description_ar ?? "",
                    en: p.description_en ?? "",
                  },
                  id: p.id,
                  logo_path: p.logo_path,
                  name: { ar: p.name_ar, en: p.name_en },
                  url: p.url ?? "",
                })
              }
              size="sm"
              variant="ghost"
            >
              {tk("edit")}
            </Button>
          </li>
        ))}
      </ul>
      <form className="grid max-w-3xl gap-4" onSubmit={submit}>
        <h3 className="type-subheading">
          {form.id ? form.name.ar || form.name.en : t("newPartner")}
        </h3>
        <BilingualField
          label={t("partner.name")}
          maxLength={200}
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          required
          value={form.name}
        />
        <p className="type-caption">{t("partner.nameHint")}</p>
        <BilingualField
          label={t("partner.description")}
          multiline
          onChange={(description) => setForm((f) => ({ ...f, description }))}
          rows={3}
          value={form.description}
        />
        <Field label={t("partner.url")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              pattern="https://.*"
              type="url"
              value={form.url}
            />
          )}
        </Field>
        <ImageField
          area="partners"
          label={t("partner.logo")}
          onChange={(logo_path) => setForm((f) => ({ ...f, logo_path }))}
          value={form.logo_path}
        />
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </section>
  );
};

export const CharityAdmin = () => {
  const t = useTranslations("nexus.admin.charity");
  const locale = useLocale() as Locale;
  const grants = useGrants();
  const campaigns = useCampaigns();
  const isGlobal = hasPermission(grants.data, "charity.manage");

  type Row = NonNullable<typeof campaigns.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (c) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/admin/charity/campaign", query: { id: c.id } }}
        >
          {localized(c, "title", locale)}
        </Link>
      ),
      header: t("columns.campaign"),
      key: "title",
    },
    {
      cell: (c) => t(`statuses.${c.status as "draft" | "active" | "closed"}`),
      header: t("columns.status"),
      key: "status",
    },
    {
      cell: (c) => formatIqd(c.progress?.counted_iqd ?? 0, locale),
      className: "whitespace-nowrap tabular-nums",
      header: t("columns.counted"),
      key: "counted",
    },
    {
      cell: (c) => formatIqd(c.progress?.pending_iqd ?? 0, locale),
      className: "whitespace-nowrap tabular-nums",
      header: t("columns.pending"),
      key: "pending",
    },
    {
      cell: (c) =>
        c.target_units
          ? `${formatNumber(c.progress?.units ?? 0)} / ${formatNumber(c.target_units)}`
          : formatNumber(c.progress?.units ?? 0),
      className: "tabular-nums",
      header: t("columns.units"),
      key: "units",
    },
  ];

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={
          isGlobal ? (
            <Link
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-primary-foreground text-sm"
              href="/admin/charity/campaign"
            >
              {t("newCampaign")}
            </Link>
          ) : null
        }
        title={t("title")}
      >
        {t("lede")}
      </AdminHeading>
      <section className="grid gap-3">
        <h2 className="type-heading">{t("campaigns")}</h2>
        {campaigns.isPending ? <SectionSpinner /> : null}
        {campaigns.data ? (
          <DataTable
            columns={columns}
            rowKey={(c) => c.id}
            rows={campaigns.data}
          />
        ) : null}
      </section>
      {isGlobal ? (
        <SalCard>
          <Partners />
        </SalCard>
      ) : null}
    </div>
  );
};

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
import { hasPermission } from "@repo/rbac";
import { localized, productions, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  type Column,
  DataTable,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { AuditionsTab, CreditsTab, RehearsalsTab } from "./company";
import { DetailsTab, RightsTab } from "./details";
import { PerformancesTab, ReportTab } from "./performances";
import { type ProductionRow, productionsKey } from "./shared";

type Stage = productions.ProductionStage;
type Kind = productions.ProductionKind;
type Origin = productions.ScriptOrigin;

const useProductionList = () => {
  const { supabase } = useAuth();
  const grants = useGrants();
  return useQuery({
    enabled: Boolean(grants.data),
    queryFn: async () =>
      (
        unwrap(
          await supabase
            .schema("programmes")
            .from("productions")
            .select("*")
            .order("created_at", { ascending: false })
        ) ?? []
      ).filter((p) =>
        hasPermission(grants.data, "productions.manage", "production", p.id)
      ),
    queryKey: productionsKey,
  });
};

const emptyProduction = {
  kind: "staged_reading" as Kind,
  playwright: "",
  script_origin: "original" as Origin,
  slug: "",
  title: { ar: "", en: "" },
};

const NewProduction = ({ onDone }: { onDone: (id: string) => void }) => {
  const t = useTranslations("nexus.admin.productions");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProduction);
  const create = useMutation({
    mutationFn: () =>
      productions.createProduction(supabase, {
        kind: form.kind,
        playwright: form.playwright,
        script_origin: form.script_origin,
        slug: form.slug,
        title_ar: form.title.ar,
        title_en: form.title.en,
      }),
    onSuccess: async (row) => {
      setForm(emptyProduction);
      await queryClient.invalidateQueries({ queryKey: productionsKey });
      if (row) {
        onDone(row.id);
      }
    },
  });

  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="type-subheading">{t("newTitle")}</h2>
      <BilingualField
        label={t("fields.title")}
        maxLength={200}
        onChange={(title) => setForm((f) => ({ ...f, title }))}
        required
        value={form.title}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field hint={t("fields.slugHint")} label={t("fields.slug")}>
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
        <Field label={t("fields.playwright")}>
          {(id) => (
            <Input
              dir="auto"
              id={id}
              maxLength={200}
              onChange={(e) =>
                setForm((f) => ({ ...f, playwright: e.target.value }))
              }
              value={form.playwright}
            />
          )}
        </Field>
        <Field label={t("fields.kind")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as Kind }))
              }
              value={form.kind}
            >
              {productions.productionKinds.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("fields.origin")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  script_origin: e.target.value as Origin,
                }))
              }
              value={form.script_origin}
            >
              {productions.scriptOrigins.map((o) => (
                <option key={o} value={o}>
                  {t(`origins.${o}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>
      <SaveButton pending={create.isPending} />
      <ErrorLine error={create.error} />
    </form>
  );
};

/**
 * Productions (Nexus admin): staged readings and productions from
 * proposal to the Program Report (Form F-25, section B). The President and
 * Vice President propose them; a Production Lead runs one.
 */
export const ProductionsAdmin = () => {
  const t = useTranslations("nexus.admin.productions");
  const locale = useLocale();
  const grants = useGrants();
  const list = useProductionList();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canPropose = hasPermission(grants.data, "productions.manage");
  const current = list.data?.find((p) => p.id === selected) ?? null;

  const columns: Column<ProductionRow>[] = [
    {
      cell: (p) => (
        <Button
          className="h-auto p-0 text-start underline underline-offset-4"
          onClick={() => setSelected(p.id)}
          variant="link"
        >
          {localized(p, "title", locale)}
        </Button>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (p) => t(`kinds.${p.kind as Kind}`),
      header: t("columns.kind"),
      key: "kind",
    },
    {
      cell: (p) => t(`stages.${p.stage as Stage}`),
      header: t("columns.stage"),
      key: "stage",
    },
    {
      cell: (p) => t(`rights.${p.rights_status as "pending" | "cleared"}`),
      header: t("columns.rights"),
      key: "rights",
    },
  ];

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={
          canPropose ? (
            <Button onClick={() => setCreating((c) => !c)} size="sm">
              {creating ? t("closeNew") : t("new")}
            </Button>
          ) : null
        }
        title={t("title")}
      >
        {t("lede")}
      </AdminHeading>
      {creating ? (
        <NewProduction
          onDone={(id) => {
            setCreating(false);
            setSelected(id);
          }}
        />
      ) : null}
      {list.isPending ? <SectionSpinner /> : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        empty={t("empty")}
        rowKey={(p) => p.id}
        rows={list.data ?? []}
      />
      {current ? <ProductionEditor production={current} /> : null}
    </div>
  );
};

const ProductionEditor = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions");
  const locale = useLocale();
  return (
    <section
      aria-labelledby="production-title"
      className="grid gap-4 border-rule border-t pt-6"
    >
      <h2 className="type-heading" id="production-title">
        {localized(production, "title", locale)}
      </h2>
      <Tabs defaultValue="details" key={production.id}>
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
          <TabsTrigger value="rights">{t("tabs.rights")}</TabsTrigger>
          <TabsTrigger value="auditions">{t("tabs.auditions")}</TabsTrigger>
          <TabsTrigger value="credits">{t("tabs.credits")}</TabsTrigger>
          <TabsTrigger value="rehearsals">{t("tabs.rehearsals")}</TabsTrigger>
          <TabsTrigger value="performances">
            {t("tabs.performances")}
          </TabsTrigger>
          <TabsTrigger value="report">{t("tabs.report")}</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsTab production={production} />
        </TabsContent>
        <TabsContent value="rights">
          <RightsTab production={production} />
        </TabsContent>
        <TabsContent value="auditions">
          <AuditionsTab production={production} />
        </TabsContent>
        <TabsContent value="credits">
          <CreditsTab production={production} />
        </TabsContent>
        <TabsContent value="rehearsals">
          <RehearsalsTab production={production} />
        </TabsContent>
        <TabsContent value="performances">
          <PerformancesTab production={production} />
        </TabsContent>
        <TabsContent value="report">
          <ReportTab production={production} />
        </TabsContent>
      </Tabs>
    </section>
  );
};

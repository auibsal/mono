"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { journal, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { SectionSpinner } from "../../states";
import {
  BilingualField,
  type Column,
  DataTable,
  DateTimeField,
  ErrorLine,
  Field,
  SaveButton,
} from "../kit";
import { pipelineKey } from "./data";

const blank = {
  closes_at: null as string | null,
  eligibility: { ar: "", en: "" },
  id: null as string | null,
  is_published: false,
  max_per_person: "2",
  opens_at: null as string | null,
  // Partners whose verified members may also answer the call.
  partners: [] as string[],
  theme: { ar: "", en: "" },
  title: { ar: "", en: "" },
};
type CallForm = typeof blank;

const callRow = (issueId: string, form: CallForm) => ({
  closes_at: form.closes_at ?? "",
  eligibility_ar: form.eligibility.ar || null,
  eligibility_en: form.eligibility.en || null,
  is_published: form.is_published,
  issue_id: issueId,
  max_per_person: Number(form.max_per_person) || 2,
  opens_at: form.opens_at ?? "",
  theme_ar: form.theme.ar || null,
  theme_en: form.theme.en || null,
  title_ar: form.title.ar,
  title_en: form.title.en,
});

/** Calls for submissions (journal.manage for the issue). */
export const Calls = ({ issueId }: { issueId: string }) => {
  const t = useTranslations("nexus.admin.pipeline.calls");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const id = useId();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const calls = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("calls")
          .select("*")
          .eq("issue_id", issueId)
          .order("opens_at", { ascending: false })
      ) ?? [],
    queryKey: [...pipelineKey, "calls", issueId],
  });
  const partnerOptions = useQuery({
    queryFn: () => journal.submissionPartners(supabase),
    queryKey: [...pipelineKey, "submission-partners"],
  });
  const save = useMutation({
    mutationFn: async () => {
      const table = supabase.schema("journal").from("calls");
      const row = callRow(issueId, form);
      let callId = form.id;
      if (callId) {
        unwrap(await table.update(row).eq("id", callId));
      } else {
        callId =
          unwrap(await table.insert(row).select("id").single())?.id ?? null;
      }
      if (callId) {
        await journal.setCallPartners(supabase, callId, form.partners);
      }
    },
    onSuccess: async () => {
      setForm(blank);
      await queryClient.invalidateQueries({
        queryKey: [...pipelineKey, "calls", issueId],
      });
    },
  });

  type Row = NonNullable<typeof calls.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (c) => localized(c, "title", locale),
      header: t("titleField"),
      key: "title",
    },
    {
      cell: (c) =>
        `${formatLongDate(c.opens_at, locale, true)} – ${formatLongDate(c.closes_at, locale, true)}`,
      header: t("window"),
      key: "window",
    },
    {
      cell: (c) => (c.is_published ? t("published") : t("hidden")),
      header: tk("status"),
      key: "status",
    },
    {
      cell: (c) => (
        <Button
          onClick={async () => {
            const partners = await journal.callPartnerIds(supabase, c.id);
            setForm({
              closes_at: c.closes_at,
              eligibility: {
                ar: c.eligibility_ar ?? "",
                en: c.eligibility_en ?? "",
              },
              id: c.id,
              is_published: c.is_published,
              max_per_person: String(c.max_per_person),
              opens_at: c.opens_at,
              partners,
              theme: { ar: c.theme_ar ?? "", en: c.theme_en ?? "" },
              title: { ar: c.title_ar, en: c.title_en },
            });
          }}
          size="sm"
          variant="ghost"
        >
          {tk("edit")}
        </Button>
      ),
      header: "",
      key: "edit",
    },
  ];

  const ready =
    form.title.en.trim() &&
    form.title.ar.trim() &&
    form.opens_at &&
    form.closes_at &&
    Date.parse(form.closes_at) > Date.parse(form.opens_at);

  return (
    <div className="grid gap-6">
      {calls.data ? (
        <DataTable
          columns={columns}
          empty={t("empty")}
          rowKey={(c) => c.id}
          rows={calls.data}
        />
      ) : (
        <SectionSpinner />
      )}
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="type-subheading">{form.id ? t("edit") : t("new")}</h3>
        <BilingualField
          label={t("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <BilingualField
          label={t("theme")}
          maxLength={500}
          onChange={(theme) => setForm((f) => ({ ...f, theme }))}
          value={form.theme}
        />
        <BilingualField
          label={t("eligibility")}
          maxLength={2000}
          multiline
          onChange={(eligibility) => setForm((f) => ({ ...f, eligibility }))}
          rows={3}
          value={form.eligibility}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label={t("opens")}
            onChange={(opens_at) => setForm((f) => ({ ...f, opens_at }))}
            value={form.opens_at}
          />
          <DateTimeField
            label={t("closes")}
            onChange={(closes_at) => setForm((f) => ({ ...f, closes_at }))}
            value={form.closes_at}
          />
        </div>
        <Field hint={t("maxHint")} label={t("max")}>
          {(fieldId) => (
            <Input
              className="w-24"
              dir="ltr"
              id={fieldId}
              max={10}
              min={1}
              onChange={(e) =>
                setForm((f) => ({ ...f, max_per_person: e.target.value }))
              }
              type="number"
              value={form.max_per_person}
            />
          )}
        </Field>
        {(partnerOptions.data ?? []).length > 0 ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-medium">{t("partners")}</legend>
            <p className="type-caption">{t("partnersHint")}</p>
            {(partnerOptions.data ?? []).map((partner) => (
              <div className="flex items-center gap-2" key={partner.id}>
                <Checkbox
                  checked={form.partners.includes(partner.id)}
                  id={`${id}-partner-${partner.id}`}
                  onCheckedChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      partners:
                        v === true
                          ? [...f.partners, partner.id]
                          : f.partners.filter((p) => p !== partner.id),
                    }))
                  }
                />
                <Label htmlFor={`${id}-partner-${partner.id}`}>
                  {localized(partner, "name", locale)}
                </Label>
              </div>
            ))}
          </fieldset>
        ) : null}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={form.is_published}
            id={`${id}-published`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, is_published: v === true }))
            }
          />
          <Label className="leading-normal" htmlFor={`${id}-published`}>
            {t("publish")}
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton disabled={!ready} pending={save.isPending} />
          {form.id ? (
            <Button
              onClick={() => setForm(blank)}
              type="button"
              variant="ghost"
            >
              {t("cancelEdit")}
            </Button>
          ) : null}
        </div>
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

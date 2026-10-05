"use client";

import { useAuth } from "@repo/auth/provider";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { localized, sanitizeRichText, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { Collaboration } from "../../editor/collaboration";
import {
  CollaborativeRichTextEditor,
  RichTextEditor,
} from "../../editor/rich-text";
import { ErrorState, SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  ConfirmAction,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";

type Body = "council" | "general_assembly";

/** Minutes, co-edited by the General Secretary and the Council; draft until adopted. */
export const MinutesEditor = () => {
  const t = useTranslations("nexus.admin.governance");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const minutesId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    body: "council" as Body,
    meeting_on: new Date().toISOString().slice(0, 10),
    text: { ar: "", en: "" },
    title: { ar: "", en: "" },
  });
  const [adoptedOn, setAdoptedOn] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const existing = useQuery({
    enabled: Boolean(minutesId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("minutes")
          .select("*")
          .eq("id", minutesId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "governance", "minutes", minutesId],
  });

  useEffect(() => {
    const m = existing.data;
    if (m) {
      setForm({
        body: m.body as Body,
        meeting_on: m.meeting_on,
        text: { ar: m.text_ar ?? "", en: m.text_en },
        title: { ar: m.title_ar ?? "", en: m.title_en },
      });
    }
  }, [existing.data]);

  const adopted = existing.data?.status === "adopted";

  const save = useMutation({
    mutationFn: async (adopt: boolean) => {
      const row = {
        adopted_on: adopt ? adoptedOn : (existing.data?.adopted_on ?? null),
        body: form.body,
        meeting_on: form.meeting_on,
        status: adopt || adopted ? "adopted" : "draft",
        text_ar: sanitizeRichText(form.text.ar) || null,
        text_en: sanitizeRichText(form.text.en),
        title_ar: form.title.ar || null,
        title_en: form.title.en,
      };
      const table = supabase.schema("governance").from("minutes");
      if (minutesId) {
        unwrap(await table.update(row).eq("id", minutesId));
        return minutesId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "governance"],
      });
      if (!minutesId) {
        router.replace({
          pathname: "/admin/governance/minutes",
          query: { id: savedId },
        });
      }
    },
  });

  if (minutesId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (minutesId && !existing.data) {
    return (
      <p className="type-body text-text-secondary">{t("minutes.notFound")}</p>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(false);
  };

  const setText = (patch: { ar?: string; en?: string }) =>
    setForm((f) => ({ ...f, text: { ...f.text, ...patch } }));
  const solo = (
    <div className="grid gap-4">
      <RichTextEditor
        label={`${t("minutes.text")} (${tk("english")})`}
        lang="en"
        onChange={(en) => setText({ en })}
        value={form.text.en}
      />
      <RichTextEditor
        label={`${t("minutes.text")} (${tk("arabic")})`}
        lang="ar"
        onChange={(ar) => setText({ ar })}
        value={form.text.ar}
      />
    </div>
  );

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/admin/governance"
          >
            {tk("back")}
          </Link>
        }
        title={
          existing.data
            ? localized(existing.data, "title", locale)
            : t("minutes.new")
        }
      >
        {adopted && existing.data?.adopted_on
          ? `${t("statuses.adopted")}, ${formatLongDate(existing.data.adopted_on, locale, true)}`
          : t("statuses.draft")}
      </AdminHeading>
      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <BilingualField
          label={t("minutes.titleField")}
          maxLength={300}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("minutes.meetingOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meeting_on: e.target.value }))
                }
                required
                type="date"
                value={form.meeting_on}
              />
            )}
          </Field>
          <Field label={t("minutes.body")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value as Body }))
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
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-medium text-sm">
            {t("minutes.text")}
          </legend>
          {minutesId ? (
            <Collaboration id={minutesId} kind="minutes" solo={solo}>
              <div className="grid gap-4">
                <CollaborativeRichTextEditor
                  field="text_en"
                  label={`${t("minutes.text")} (${tk("english")})`}
                  lang="en"
                  onChange={(en) => setText({ en })}
                  value={form.text.en}
                />
                <CollaborativeRichTextEditor
                  field="text_ar"
                  label={`${t("minutes.text")} (${tk("arabic")})`}
                  lang="ar"
                  onChange={(ar) => setText({ ar })}
                  value={form.text.ar}
                />
              </div>
            </Collaboration>
          ) : (
            solo
          )}
        </fieldset>
        <p className="type-caption">{t("minutes.draftNote")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <SaveButton pending={save.isPending} success={save.isSuccess} />
          {minutesId && !adopted ? (
            <>
              <Field className="w-44" label={t("minutes.adoptedOn")}>
                {(id) => (
                  <Input
                    dir="ltr"
                    id={id}
                    onChange={(e) => setAdoptedOn(e.target.value)}
                    type="date"
                    value={adoptedOn}
                  />
                )}
              </Field>
              <ConfirmAction
                confirmLabel={t("minutes.adopt")}
                description={t("minutes.adoptConfirm")}
                disabled={save.isPending}
                onConfirm={() => save.mutate(true)}
                variant="default"
              >
                {t("minutes.adopt")}
              </ConfirmAction>
            </>
          ) : null}
        </div>
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

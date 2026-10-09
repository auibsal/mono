"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import { formatIqd, formatNumber } from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { forms, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { ErrorLine, Field, SelectInput } from "../admin/kit";
import { MemberPicker, useMemberNames } from "../admin/member-picker";
import { EmptyLine, SectionSpinner } from "../states";
import { FormFieldInput, type FormLabels, useFormLabels } from "./field";

type Data = forms.FormData;
type FormField = forms.FormField;

interface Person {
  full_name_ar: string | null;
  full_name_en: string;
  id: string;
}

const numeric = (field: FormField) =>
  field.type === "number" || field.type === "iqd";

const toNumber = (value: unknown) =>
  value === "" || value === undefined || value === null ? null : Number(value);

const normalizeRow = (columns: readonly FormField[], row: Data) =>
  Object.fromEntries(
    columns.map((col) => [
      col.key,
      numeric(col) ? toNumber(row[col.key]) : row[col.key],
    ])
  );

/** Numbers stored as numbers, empty values dropped. */
const normalize = (fields: readonly FormField[], data: Data): Data => {
  const out: Data = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined || value === "") {
      continue;
    }
    if (numeric(field)) {
      out[field.key] = toNumber(value);
    } else if (field.type === "table" && Array.isArray(value)) {
      out[field.key] = value.map((row) =>
        normalizeRow(field.columns ?? [], row as Data)
      );
    } else if (field.type === "grid") {
      out[field.key] = Object.fromEntries(
        Object.entries((value ?? {}) as Record<string, Data>).map(
          ([row, cells]) => [row, normalizeRow(field.columns ?? [], cells)]
        )
      );
    } else {
      out[field.key] = value;
    }
  }
  return out;
};

const Totals = ({ data, formKey }: { data: Data; formKey: string }) => {
  const t = useTranslations("nexus.forms");
  const locale = useLocale() as Locale;
  if (formKey === "f04") {
    return (
      <p className="type-body font-bold" role="status">
        {t("interviewTotal", {
          total: formatNumber(forms.interviewTotal(data)),
        })}
        {forms.interviewVeto(data) ? ` · ${t("interviewVeto")}` : ""}
      </p>
    );
  }
  if (formKey === "f13") {
    return (
      <p className="type-body font-bold" role="status">
        {t("claimTotal", {
          total: formatIqd(forms.claimTotal(data), locale),
        })}
      </p>
    );
  }
  if (formKey === "f14") {
    const totals = forms.cashTotals(data);
    return (
      <p className="type-body font-bold" role="status">
        {t("cashTotals", {
          one: formatIqd(totals.count1, locale),
          two: formatIqd(totals.count2, locale),
        })}
      </p>
    );
  }
  return null;
};

const AnonymousOption = ({
  onChange,
  value,
}: {
  onChange: (value: boolean) => void;
  value: boolean;
}) => {
  const t = useTranslations("nexus.forms");
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={value}
          id="anonymous"
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <Label className="font-normal" htmlFor="anonymous">
          {t("anonymous")}
        </Label>
      </div>
      <p className="type-caption">{t("anonymousHint")}</p>
    </div>
  );
};

const ProblemsLine = ({
  labels,
  problems,
}: {
  labels: FormLabels;
  problems: string[];
}) => {
  const t = useTranslations("nexus.forms");
  return problems.length > 0 ? (
    <p className="text-sm text-title" role="alert">
      {t("problems", {
        fields: problems.map((key) => labels.field(key)).join(" · "),
      })}
    </p>
  ) : null;
};

/** Fill in a form, save a draft, or send it. */
export const FillForm = () => {
  const t = useTranslations("nexus.forms");
  const params = useSearchParams();
  const formKey = params.get("form");
  const id = params.get("id");
  if (!forms.isFormKey(formKey)) {
    return (
      <EmptyLine action={{ href: "/forms", label: t("back") }}>
        {t("notFound")}
      </EmptyLine>
    );
  }
  return <FormEditor formKey={formKey} id={id} key={`${formKey}-${id}`} />;
};

const FormEditor = ({
  formKey,
  id,
}: {
  formKey: forms.FormKey;
  id: string | null;
}) => {
  const t = useTranslations("nexus.forms");
  const definition = forms.forms[formKey];
  const labels = useFormLabels(formKey);
  const { supabase } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Data>({});
  const [subject, setSubject] = useState<Person | null>(null);
  const [routing, setRouting] = useState<forms.Routing>("none");
  const [anonymous, setAnonymous] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [sentAnonymously, setSentAnonymously] = useState(false);

  const existing = useQuery({
    enabled: Boolean(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("form_submissions")
          .select("*")
          .eq("id", id ?? "")
          .maybeSingle()
      ),
    queryKey: ["forms", "submission", id],
  });
  const subjectName = useMemberNames([existing.data?.subject_user_id]);

  useEffect(() => {
    if (existing.data) {
      setData((existing.data.data ?? {}) as Data);
      setRouting(existing.data.routing as forms.Routing);
    }
  }, [existing.data]);
  useEffect(() => {
    const row = subjectName.data?.[0];
    if (row) {
      setSubject(row);
    }
  }, [subjectName.data]);

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      forms.saveForm(supabase, {
        anonymous,
        data: normalize(definition.fields, data),
        form: formKey,
        id,
        routing,
        subjectId: subject?.id ?? null,
        submit,
      }),
    onSuccess: async (savedId, submit) => {
      await queryClient.invalidateQueries({ queryKey: ["forms"] });
      if (anonymous) {
        setSentAnonymously(true);
        return;
      }
      router.push(
        submit
          ? { pathname: "/forms/view", query: { id: savedId } }
          : { pathname: "/forms/fill", query: { form: formKey, id: savedId } }
      );
    },
  });

  if (id && existing.isPending) {
    return <SectionSpinner />;
  }
  if (id && !existing.data) {
    return (
      <EmptyLine action={{ href: "/forms", label: t("back") }}>
        {t("notFound")}
      </EmptyLine>
    );
  }
  if (sentAnonymously) {
    return (
      <EmptyLine action={{ href: "/forms", label: t("back") }}>
        {t("sentAnonymously")}
      </EmptyLine>
    );
  }

  const isDraft = !existing.data || existing.data.status === "draft";
  const lockedSubject = Boolean(existing.data?.subject_user_id) && !isDraft;
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = forms.formProblems(definition, data);
    setProblems(found);
    if (found.length === 0) {
      save.mutate(true);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <header className="grid gap-2">
        <p className="type-kicker">{definition.code}</p>
        <h1 className="type-display">{labels.title()}</h1>
        <p className="type-lede max-w-2xl">{labels.purpose()}</p>
      </header>
      {definition.preamble ? (
        <p className="type-body rounded-card bg-surface-tint p-5">
          {labels.preamble()}
        </p>
      ) : null}

      <form className="grid gap-5" noValidate onSubmit={onSubmit}>
        {definition.subject && lockedSubject ? (
          <p className="type-body">
            {t("about", { name: subject?.full_name_en ?? "" })}
          </p>
        ) : null}
        {definition.subject && !lockedSubject ? (
          <MemberPicker
            label={t("subject")}
            onChange={setSubject}
            value={subject}
          />
        ) : null}
        {definition.routing && isDraft ? (
          <Field hint={t("routingHint")} label={t("routing")}>
            {(fieldId) => (
              <SelectInput
                id={fieldId}
                onChange={(e) => setRouting(e.target.value as forms.Routing)}
                value={routing}
              >
                {forms.routings.map((r) => (
                  <option key={r} value={r}>
                    {t(`routings.${r}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        ) : null}
        {definition.fields.map((field) => (
          <FormFieldInput
            field={field}
            invalid={problems.includes(field.key)}
            key={field.key}
            labels={labels}
            onChange={(value) => setData((d) => ({ ...d, [field.key]: value }))}
            value={data[field.key]}
          />
        ))}
        <Totals data={data} formKey={formKey} />
        {definition.anonymous && !id ? (
          <AnonymousOption onChange={setAnonymous} value={anonymous} />
        ) : null}
        <ProblemsLine labels={labels} problems={problems} />
        <div className="flex flex-wrap gap-3">
          {isDraft ? (
            <Button disabled={save.isPending} type="submit">
              {t("send")}
            </Button>
          ) : (
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate(false)}
              type="button"
            >
              {t("saveChanges")}
            </Button>
          )}
          {isDraft && !anonymous ? (
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate(false)}
              type="button"
              variant="outline"
            >
              {t("saveDraft")}
            </Button>
          ) : null}
          <Link className="type-body self-center underline" href="/forms">
            {t("back")}
          </Link>
        </div>
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

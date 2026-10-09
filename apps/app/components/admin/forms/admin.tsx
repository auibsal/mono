"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
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
import { hasPermission, type Permission } from "@repo/rbac";
import { forms, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useGrants } from "@/lib/queries";
import { FormFieldInput, useFormLabels } from "../../forms/field";
import { useFormTypes } from "../../forms/forms";
import { type Submission, SubmissionSheet } from "../../forms/view";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  type Column,
  DataTable,
  ErrorLine,
  Field,
  SelectInput,
} from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";
import { Letters } from "./letters";

const key = ["admin", "forms"];

type Show = "open" | "closed" | "all";

const FormName = ({ formKey }: { formKey: string }) => {
  const labels = useFormLabels(formKey);
  return <>{labels.title()}</>;
};

/**
 * Forms and letters (Nexus admin): the forms sent to you to handle, by
 * form, with their answer dates and office-use boxes; and the standard
 * letters to fill in and print.
 */
export const FormsAdmin = () => {
  const t = useTranslations("nexus.admin.forms");
  return (
    <div className="grid gap-8">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue="submissions">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="submissions">{t("tabs.submissions")}</TabsTrigger>
          <TabsTrigger value="letters">{t("tabs.letters")}</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">
          <Submissions />
        </TabsContent>
        <TabsContent value="letters">
          <Letters />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Submissions = () => {
  const t = useTranslations("nexus.admin.forms");
  const tf = useTranslations("nexus.forms");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const grants = useGrants();
  const types = useFormTypes();
  const [form, setForm] = useState("");
  const [show, setShow] = useState<Show>("open");
  const [selected, setSelected] = useState<string | null>(null);

  const handled = (types.data ?? []).filter((ty) =>
    hasPermission(grants.data, ty.handle_permission as Permission)
  );
  const handledKeys = handled.map((ty) => ty.key);

  const queue = useQuery({
    queryFn: () => forms.formQueue(supabase),
    queryKey: [...key, "queue"],
  });
  const list = useQuery({
    enabled: handledKeys.length > 0,
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("form_submissions")
          .select("*")
          .neq("status", "draft")
          .in("form_key", handledKeys)
          .order("submitted_at", { ascending: false })
          .limit(500)
      ) ?? []) as Submission[],
    queryKey: [...key, "list", handledKeys],
  });
  const names = useMemberNames((list.data ?? []).map((s) => s.submitted_by));
  const nameOf = (id: string | null) => {
    const row = names.data?.find((p) => p.id === id);
    return row ? memberName(row, locale) : tf("anonymousSender");
  };

  const rows = (list.data ?? []).filter(
    (s) =>
      (form === "" || s.form_key === form) &&
      (show === "all" ||
        (show === "closed" ? s.status === "closed" : s.status !== "closed")) &&
      // What you sent yourself is in Forms, not your queue.
      s.submitted_by !== user?.id
  );
  const current = rows.find((s) => s.id === selected) ?? null;

  const columns: Column<Submission>[] = [
    {
      cell: (s) => (
        <Button
          className="h-auto p-0 text-start underline underline-offset-4"
          onClick={() => setSelected(s.id)}
          variant="link"
        >
          <FormName formKey={s.form_key} />
        </Button>
      ),
      header: t("columns.form"),
      key: "form",
    },
    {
      cell: (s) => nameOf(s.submitted_by),
      header: t("columns.from"),
      key: "from",
    },
    {
      cell: (s) =>
        s.submitted_at ? formatLongDate(s.submitted_at, locale, true) : "",
      header: t("columns.sent"),
      key: "sent",
    },
    {
      cell: (s) => tf(`statuses.${s.status as forms.FormStatus}`),
      header: t("columns.status"),
      key: "status",
    },
  ];

  if (types.isPending || grants.isPending) {
    return <SectionSpinner />;
  }
  if (handled.length === 0) {
    return <p className="type-body pt-4">{t("noForms")}</p>;
  }

  return (
    <div className="grid gap-6 pt-4">
      <ul className="flex flex-wrap gap-2">
        {(queue.data ?? []).map((q) => (
          <li
            className="rounded-card bg-surface-tint px-3 py-2"
            key={q.form_key}
          >
            <span className="font-medium">
              <FormName formKey={q.form_key} />
            </span>
            <span className="type-caption">
              {" · "}
              {t("waiting", {
                count: Number(q.waiting),
                countText: formatNumber(Number(q.waiting)),
              })}
              {Number(q.overdue) > 0
                ? ` · ${t("overdue", {
                    count: Number(q.overdue),
                    countText: formatNumber(Number(q.overdue)),
                  })}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("filterForm")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) => setForm(e.target.value)}
              value={form}
            >
              <option value="">{t("allForms")}</option>
              {handled.map((ty) => (
                <option key={ty.key} value={ty.key}>
                  {ty.code}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("filterShow")}>
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) => setShow(e.target.value as Show)}
              value={show}
            >
              <option value="open">{t("show.open")}</option>
              <option value="closed">{t("show.closed")}</option>
              <option value="all">{t("show.all")}</option>
            </SelectInput>
          )}
        </Field>
      </div>
      {list.isPending ? <SectionSpinner /> : null}
      <DataTable
        caption={t("tabs.submissions")}
        columns={columns}
        empty={t("empty")}
        rowKey={(s) => s.id}
        rows={rows}
      />
      {current ? <Handle submission={current} /> : null}
    </div>
  );
};

const Handle = ({ submission }: { submission: Submission }) => {
  const t = useTranslations("nexus.admin.forms");
  const tf = useTranslations("nexus.forms");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const formKey = submission.form_key as forms.FormKey;
  const definition = forms.forms[formKey];
  const labels = useFormLabels(formKey);
  const [office, setOffice] = useState<forms.FormData>(
    (submission.office ?? {}) as forms.FormData
  );

  const act = useMutation({
    mutationFn: (status: "acknowledged" | "in_progress" | "closed") =>
      forms.handleForm(supabase, submission.id, status, office),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const keepStatus =
    submission.status === "submitted"
      ? "acknowledged"
      : (submission.status as "acknowledged" | "in_progress" | "closed");

  return (
    <section
      className="grid gap-4 border-rule border-t pt-6"
      key={submission.id}
    >
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()} size="sm" variant="outline">
          {tf("print")}
        </Button>
      </div>
      <SubmissionSheet
        actions={
          <div className="grid gap-4">
            {definition.office ? (
              <div className="grid gap-3">
                <h3 className="type-subheading">{tf("office")}</h3>
                {definition.office.map((field) => (
                  <FormFieldInput
                    field={field}
                    key={field.key}
                    labels={labels}
                    office
                    onChange={(value) =>
                      setOffice((o) => ({ ...o, [field.key]: value }))
                    }
                    value={office[field.key]}
                  />
                ))}
                <Button
                  className="justify-self-start"
                  disabled={act.isPending}
                  onClick={() => act.mutate(keepStatus)}
                  size="sm"
                  variant="outline"
                >
                  {t("saveOffice")}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {submission.status === "submitted" ? (
                <Button
                  disabled={act.isPending}
                  onClick={() => act.mutate("acknowledged")}
                  size="sm"
                >
                  {t("acknowledge")}
                </Button>
              ) : null}
              {submission.status === "closed" ? null : (
                <>
                  <Button
                    disabled={
                      act.isPending || submission.status === "in_progress"
                    }
                    onClick={() => act.mutate("in_progress")}
                    size="sm"
                    variant="outline"
                  >
                    {t("takeUp")}
                  </Button>
                  <Button
                    disabled={act.isPending}
                    onClick={() => act.mutate("closed")}
                    size="sm"
                    variant="outline"
                  >
                    {t("close")}
                  </Button>
                </>
              )}
            </div>
            <ErrorLine error={act.error} />
          </div>
        }
        submission={submission}
      />
    </section>
  );
};

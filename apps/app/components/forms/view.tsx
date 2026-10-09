"use client";

import { useAuth } from "@repo/auth/provider";
import type { Tables } from "@repo/database/types";
import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { forms, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemberNames } from "../admin/member-picker";
import { memberName } from "../admin/members/directory";
import { EmptyLine, SectionSpinner } from "../states";
import { FormValues, useFormLabels } from "./field";
import { useFormTypes } from "./forms";

export type Submission = Tables<{ schema: "governance" }, "form_submissions">;

const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 864e5).toISOString();

/**
 * A submitted form laid out for reading and printing (light paper, like
 * the printed form), with who sent it, when, and its answer dates.
 */
export const SubmissionSheet = ({
  actions,
  submission,
}: {
  actions?: ReactNode;
  submission: Submission;
}) => {
  const t = useTranslations("nexus.forms");
  const locale = useLocale() as Locale;
  const key = submission.form_key as forms.FormKey;
  const definition = forms.forms[key];
  const labels = useFormLabels(key);
  const types = useFormTypes();
  const names = useMemberNames([
    submission.submitted_by,
    submission.subject_user_id,
  ]);
  const nameOf = (id: string | null) => {
    const row = names.data?.find((p) => p.id === id);
    return row ? memberName(row, locale) : "";
  };
  const type = types.data?.find((ty) => ty.key === key);
  const open = submission.status !== "closed" && submission.submitted_at;

  return (
    <article
      className="grid gap-6 rounded-card bg-surface p-6 text-text print:p-0"
      data-theme="light"
    >
      <header className="grid gap-1 border-accent-line border-b-2 pb-3">
        <p className="type-kicker">
          {definition.code} · {t("society")}
        </p>
        <h2 className="type-heading">{labels.title()}</h2>
        <p className="type-caption">
          {t(`statuses.${submission.status as forms.FormStatus}`)}
          {submission.submitted_at
            ? ` · ${t("sentOn", { date: formatLongDate(submission.submitted_at, locale, true) })}`
            : ""}
          {" · "}
          {submission.submitted_by
            ? t("from", { name: nameOf(submission.submitted_by) })
            : t("anonymousSender")}
          {submission.subject_user_id
            ? ` · ${t("about", { name: nameOf(submission.subject_user_id) })}`
            : ""}
          {submission.routing === "none"
            ? ""
            : ` · ${t(`routings.${submission.routing as forms.Routing}`)}`}
        </p>
        {open && type?.acknowledge_days && !submission.acknowledged_at ? (
          <p className="type-caption">
            {t("acknowledgeBy", {
              date: formatLongDate(
                addDays(submission.submitted_at ?? "", type.acknowledge_days),
                locale
              ),
            })}
          </p>
        ) : null}
        {open && type?.answer_days ? (
          <p className="type-caption">
            {t("answerBy", {
              date: formatLongDate(
                addDays(submission.submitted_at ?? "", type.answer_days),
                locale
              ),
            })}
          </p>
        ) : null}
      </header>
      <FormValues
        data={(submission.data ?? {}) as forms.FormData}
        fields={definition.fields}
        labels={labels}
      />
      {definition.office && Object.keys(submission.office ?? {}).length > 0 ? (
        <section className="grid gap-2">
          <h3 className="type-subheading">{t("office")}</h3>
          <FormValues
            data={(submission.office ?? {}) as forms.FormData}
            fields={definition.office}
            labels={labels}
            office
          />
        </section>
      ) : null}
      {actions ? <div className="print:hidden">{actions}</div> : null}
    </article>
  );
};

/** One of your forms (or one about you), to read, print or keep updating. */
export const ViewForm = () => {
  const t = useTranslations("nexus.forms");
  const { supabase } = useAuth();
  const id = useSearchParams().get("id") ?? "";
  const types = useFormTypes();
  const submission = useQuery({
    enabled: Boolean(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("form_submissions")
          .select("*")
          .eq("id", id)
          .maybeSingle()
      ),
    queryKey: ["forms", "submission", id],
  });

  if (submission.isPending && id) {
    return <SectionSpinner />;
  }
  if (!submission.data) {
    return (
      <EmptyLine action={{ href: "/forms", label: t("back") }}>
        {t("notFound")}
      </EmptyLine>
    );
  }
  const row = submission.data;
  const ongoing = types.data?.find((ty) => ty.key === row.form_key)?.ongoing;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link className="type-body underline" href="/forms">
          {t("back")}
        </Link>
        <Button onClick={() => window.print()} size="sm" variant="outline">
          {t("print")}
        </Button>
        {ongoing && row.status !== "closed" ? (
          <Link
            className="type-body underline"
            href={{
              pathname: "/forms/fill",
              query: { form: row.form_key, id: row.id },
            }}
          >
            {t("update")}
          </Link>
        ) : null}
      </div>
      <SubmissionSheet submission={row} />
    </div>
  );
};

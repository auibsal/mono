"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermission, type Permission } from "@repo/rbac";
import { forms, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useGrants, useMemberStatus } from "@/lib/queries";
import { EmptyLine, SectionSpinner } from "../states";

type FormType = Awaited<ReturnType<typeof forms.formTypes>>[number];

/** Whether the person may start this form (the database checks again). */
export const useMayStart = () => {
  const grants = useGrants();
  const status = useMemberStatus();
  return (type: FormType) => {
    switch (type.submit_rule) {
      case "anyone":
        return true;
      case "member":
        return Boolean(status.data?.is_member);
      case "role_holder":
        return (grants.data ?? []).length > 0;
      case "handler":
        return hasPermission(grants.data, type.handle_permission as Permission);
      default:
        return false;
    }
  };
};

export const useFormTypes = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: () => forms.formTypes(supabase),
    queryKey: ["forms", "types"],
    staleTime: 60 * 60 * 1000,
  });
};

const FormTitle = ({ formKey }: { formKey: string }) => {
  const t = useTranslations("nexus.forms.defs");
  return <>{t(`${formKey}.title` as Parameters<typeof t>[0])}</>;
};

/**
 * Forms (Templates & Forms): the ones you can fill in here, where the
 * others live in the Nexus, and the forms you have sent or that are about
 * you.
 */
export const Forms = () => {
  const t = useTranslations("nexus.forms");
  const td = useTranslations("nexus.forms.defs");
  const te = useTranslations("nexus.forms.elsewhere");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const types = useFormTypes();
  const mayStart = useMayStart();

  const mine = useQuery({
    enabled: Boolean(user),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("form_submissions")
          .select(
            "id, form_key, status, submitted_at, created_at, submitted_by, subject_user_id"
          )
          .or(`submitted_by.eq.${user?.id},subject_user_id.eq.${user?.id}`)
          .order("created_at", { ascending: false })
      ) ?? [],
    queryKey: ["forms", "mine", user?.id],
  });

  const available = (types.data ?? []).filter(mayStart);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("mine")}</h2>
        {mine.isPending ? <SectionSpinner /> : null}
        {mine.data?.length === 0 ? (
          <p className="type-body text-text-secondary">{t("noMine")}</p>
        ) : null}
        <ul className="grid gap-2">
          {(mine.data ?? []).map((s) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-2 border-rule border-b pb-2"
              key={s.id}
            >
              <Link
                className="underline underline-offset-4"
                href={
                  s.status === "draft"
                    ? {
                        pathname: "/forms/fill",
                        query: { form: s.form_key, id: s.id },
                      }
                    : { pathname: "/forms/view", query: { id: s.id } }
                }
              >
                <FormTitle formKey={s.form_key} />
              </Link>
              <span className="type-caption">
                {t(`statuses.${s.status as forms.FormStatus}`)} ·{" "}
                {formatLongDate(s.submitted_at ?? s.created_at, locale, true)}
                {s.subject_user_id === user?.id && s.submitted_by !== user?.id
                  ? ` · ${t("aboutYou")}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("available")}</h2>
        {types.isPending ? <SectionSpinner /> : null}
        {types.data && available.length === 0 ? (
          <EmptyLine action={{ href: "/", label: t("home") }}>
            {t("noneAvailable")}
          </EmptyLine>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {available.map((type) => (
            <li key={type.key}>
              <SalCard>
                <div className="grid gap-2">
                  <p className="type-kicker">{type.code}</p>
                  <Link
                    className="font-bold underline underline-offset-4"
                    href={{
                      pathname: "/forms/fill",
                      query: { form: type.key },
                    }}
                  >
                    <FormTitle formKey={type.key} />
                  </Link>
                  <p className="type-caption">
                    {td(`${type.key}.purpose` as Parameters<typeof td>[0])}
                  </p>
                </div>
              </SalCard>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("elsewhereTitle")}</h2>
        <p className="type-body">{t("elsewhereLede")}</p>
        <ul className="grid gap-2">
          {forms.formsElsewhere.map((f) => (
            <li key={f.key}>
              <span className="type-kicker">{f.code}</span>{" "}
              <Link className="underline underline-offset-4" href={f.path}>
                {te(f.key)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

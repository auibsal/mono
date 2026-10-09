"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { localized, recognition, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { ErrorLine } from "../admin/kit";
import { EmptyLine, SectionSpinner } from "../states";

const KEY = ["service"];

type RecordStatus = "pending" | "confirmed" | "rejected";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * My service: the Volunteer Hours Log (Form F-16) and certificates. Hours
 * count once someone else confirms them; forty in an academic year make a
 * member eligible to be nominated as a Fellow (B4.1).
 */
export const Service = () => {
  const t = useTranslations("nexus.service");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const empty = {
    activity: "",
    hours: "",
    occurred_on: today(),
    programme_id: "",
    what: "",
  };
  const [form, setForm] = useState(empty);

  const hours = useQuery({
    queryFn: () => recognition.serviceHours(supabase),
    queryKey: [...KEY, "hours"],
  });
  const records = useQuery({
    queryFn: () => recognition.myService(supabase),
    queryKey: [...KEY, "records"],
  });
  const certificates = useQuery({
    queryFn: () => recognition.myCertificates(supabase),
    queryKey: [...KEY, "certificates"],
  });
  const programmes = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("programmes")
          .select("id, name_en, name_ar")
          .order("sort")
      ) ?? [],
    queryKey: [...KEY, "programmes"],
  });

  const log = useMutation({
    mutationFn: () =>
      recognition.logHours(supabase, {
        activity: form.activity,
        hours: Number(form.hours),
        occurred_on: form.occurred_on,
        programme_id: form.programme_id || null,
        what: form.what,
      }),
    onSuccess: async () => {
      setForm(empty);
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
  const withdraw = useMutation({
    mutationFn: async (recordId: string) =>
      unwrap(
        await supabase
          .schema("membership")
          .from("service_records")
          .delete()
          .eq("id", recordId)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const total = hours.data ?? 0;
  const progress = Math.min(1, total / recognition.FELLOWSHIP_HOURS);
  const programmeName = (programmeId: string | null) => {
    const row = programmes.data?.find((p) => p.id === programmeId);
    return row ? localized(row, "name", locale) : "";
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    log.mutate();
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>

      <SalCard>
        <div className="grid gap-3">
          <p className="type-kicker">{t("thisYear")}</p>
          <p className="font-bold text-3xl">
            {t("hours", { hours: formatNumber(total) })}
          </p>
          <div
            aria-label={t("progressLabel", {
              hours: formatNumber(total),
              target: formatNumber(recognition.FELLOWSHIP_HOURS),
            })}
            aria-valuemax={recognition.FELLOWSHIP_HOURS}
            aria-valuemin={0}
            aria-valuenow={total}
            className="h-2 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
          >
            <div
              className="h-full bg-band"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="type-caption">
            {total >= recognition.FELLOWSHIP_HOURS
              ? t("eligible")
              : t("towardsFellowship", {
                  target: formatNumber(recognition.FELLOWSHIP_HOURS),
                })}
          </p>
        </div>
      </SalCard>

      <section className="grid gap-4">
        <h2 className="type-subheading">{t("logTitle")}</h2>
        <p className="type-body">{t("logLede")}</p>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-date`}>{t("date")}</Label>
              <Input
                dir="ltr"
                id={`${id}-date`}
                max={today()}
                onChange={(e) =>
                  setForm((f) => ({ ...f, occurred_on: e.target.value }))
                }
                required
                type="date"
                value={form.occurred_on}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-hours`}>{t("hoursLabel")}</Label>
              <Input
                dir="ltr"
                id={`${id}-hours`}
                inputMode="decimal"
                max={24}
                min={0.25}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hours: e.target.value }))
                }
                required
                step={0.25}
                type="number"
                value={form.hours}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-programme`}>{t("programme")}</Label>
              <select
                className="frame h-10 bg-surface px-3"
                id={`${id}-programme`}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programme_id: e.target.value }))
                }
                value={form.programme_id}
              >
                <option value="">{t("noProgramme")}</option>
                {(programmes.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {localized(p, "name", locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-activity`}>{t("activity")}</Label>
            <Input
              dir="auto"
              id={`${id}-activity`}
              maxLength={200}
              onChange={(e) =>
                setForm((f) => ({ ...f, activity: e.target.value }))
              }
              required
              value={form.activity}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-what`}>{t("what")}</Label>
            <Textarea
              dir="auto"
              id={`${id}-what`}
              maxLength={1000}
              onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
              rows={2}
              value={form.what}
            />
          </div>
          <p className="type-caption">{t("confirmNote")}</p>
          <Button
            className="justify-self-start"
            disabled={log.isPending}
            type="submit"
          >
            {t("log")}
          </Button>
          <ErrorLine error={log.error} />
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("recordsTitle")}</h2>
        {records.isPending ? <SectionSpinner /> : null}
        {records.data?.length === 0 ? (
          <EmptyLine action={{ href: "/programs", label: t("findShift") }}>
            {t("noRecords")}
          </EmptyLine>
        ) : null}
        <ul className="grid gap-2">
          {(records.data ?? []).map((r) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-2 border-rule border-b pb-2"
              key={r.id}
            >
              <span className="grid">
                <span className="font-medium" dir="auto">
                  {r.activity}
                </span>
                <span className="type-caption">
                  {formatLongDate(r.occurred_on, locale, true)}
                  {r.programme_id ? ` · ${programmeName(r.programme_id)}` : ""}
                  {" · "}
                  {t(`statuses.${r.status as RecordStatus}`)}
                  {r.reject_reason ? ` · ${r.reject_reason}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-bold">
                  {t("hours", { hours: formatNumber(Number(r.hours)) })}
                </span>
                {r.status === "pending" ? (
                  <Button
                    disabled={withdraw.isPending}
                    onClick={() => withdraw.mutate(r.id)}
                    size="sm"
                    variant="ghost"
                  >
                    {t("withdraw")}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("certificatesTitle")}</h2>
        {certificates.data?.length === 0 ? (
          <p className="type-body text-text-secondary">{t("noCertificates")}</p>
        ) : null}
        <ul className="grid gap-2">
          {(certificates.data ?? []).map((c) => (
            <li key={c.id}>
              <Link
                className="underline underline-offset-4"
                href={{ pathname: "/certificate", query: { id: c.id } }}
              >
                {t(`kinds.${c.kind as recognition.CertificateKind}`)}
                {c.serial ? ` · ${c.serial}` : ""}
              </Link>
              {c.status === "revoked" ? (
                <span className="type-caption"> · {t("revoked")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

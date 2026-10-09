"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { hasPermission } from "@repo/rbac";
import { localized, productions, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useGrants } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import { ErrorLine, Field, SaveButton, SelectInput } from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";
import { type ProductionRow, productionKey, productionsKey } from "./shared";

// ── Performances and partners ───────────────────────────────────────────────

export const PerformancesTab = ({
  production,
}: {
  production: ProductionRow;
}) => {
  const t = useTranslations("nexus.admin.productions.performancesTab");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const key = [...productionKey(production.id), "performances"];
  const [eventId, setEventId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const cleared = production.rights_status === "cleared";

  const data = useQuery({
    queryFn: async () => {
      const [links, events, partners, choices] = await Promise.all([
        supabase
          .schema("programmes")
          .from("production_events")
          .select("event_id")
          .eq("production_id", production.id),
        supabase
          .schema("events")
          .from("events")
          .select("id, title_en, title_ar, starts_at, status")
          .gte("starts_at", new Date(Date.now() - 864e5 * 60).toISOString())
          .order("starts_at"),
        supabase
          .schema("programmes")
          .from("production_partners")
          .select("partner_id")
          .eq("production_id", production.id),
        productions.partnerChoices(supabase),
      ]);
      return {
        choices,
        events: unwrap(events) ?? [],
        linked: new Set((unwrap(links) ?? []).map((l) => l.event_id)),
        partners: new Set((unwrap(partners) ?? []).map((p) => p.partner_id)),
      };
    },
    queryKey: key,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const link = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_events")
          .insert({ event_id: id, production_id: production.id })
      ),
    onSuccess: async () => {
      setEventId("");
      await refresh();
    },
  });
  const unlink = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_events")
          .delete()
          .eq("production_id", production.id)
          .eq("event_id", id)
      ),
    onSuccess: refresh,
  });
  const addPartner = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_partners")
          .insert({ partner_id: id, production_id: production.id })
      ),
    onSuccess: async () => {
      setPartnerId("");
      await refresh();
    },
  });
  const removePartner = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_partners")
          .delete()
          .eq("production_id", production.id)
          .eq("partner_id", id)
      ),
    onSuccess: refresh,
  });

  if (data.isPending) {
    return <SectionSpinner />;
  }
  const events = data.data?.events ?? [];
  const linked = events.filter((e) => data.data?.linked.has(e.id));
  const choices = data.data?.choices ?? [];

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <section className="grid gap-3">
        <h3 className="type-subheading">{t("title")}</h3>
        <p className="type-body">{t("lede")}</p>
        {cleared ? null : <p className="type-caption">{t("rightsFirst")}</p>}
        {linked.length === 0 ? (
          <p className="type-caption">{t("none")}</p>
        ) : null}
        <ul className="grid gap-2">
          {linked.map((e) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 border-rule border-b pb-2"
              key={e.id}
            >
              <span>
                <span className="font-medium">
                  {localized(e, "title", locale)}
                </span>
                <span className="type-caption">
                  {" · "}
                  {formatLongDate(e.starts_at, locale)} ·{" "}
                  {formatClock(e.starts_at, locale)}
                </span>
              </span>
              <Button
                disabled={unlink.isPending}
                onClick={() => unlink.mutate(e.id)}
                size="sm"
                variant="ghost"
              >
                {t("unlink")}
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            link.mutate(eventId);
          }}
        >
          <Field className="min-w-64" label={t("event")}>
            {(id) => (
              <SelectInput
                disabled={!cleared}
                id={id}
                onChange={(e) => setEventId(e.target.value)}
                required
                value={eventId}
              >
                <option value="">{t("choose")}</option>
                {events
                  .filter((e) => !data.data?.linked.has(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {localized(e, "title", locale)} ·{" "}
                      {formatLongDate(e.starts_at, locale)}
                    </option>
                  ))}
              </SelectInput>
            )}
          </Field>
          <Button disabled={!cleared || link.isPending} type="submit">
            {t("link")}
          </Button>
        </form>
        <p className="type-caption">{t("eventHint")}</p>
        <ErrorLine error={link.error} />
      </section>

      <section className="grid gap-3">
        <h3 className="type-subheading">{t("partnersTitle")}</h3>
        <p className="type-body">{t("partnersLede")}</p>
        <ul className="grid gap-2">
          {choices
            .filter((p) => data.data?.partners.has(p.id))
            .map((p) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 border-rule border-b pb-2"
                key={p.id}
              >
                <span className="font-medium">
                  {localized(p, "name", locale)}
                </span>
                <Button
                  disabled={removePartner.isPending}
                  onClick={() => removePartner.mutate(p.id)}
                  size="sm"
                  variant="ghost"
                >
                  {t("removePartner")}
                </Button>
              </li>
            ))}
        </ul>
        {choices.length === 0 ? (
          <p className="type-caption">{t("noPartners")}</p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addPartner.mutate(partnerId);
            }}
          >
            <Field className="min-w-64" label={t("partner")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) => setPartnerId(e.target.value)}
                  required
                  value={partnerId}
                >
                  <option value="">{t("choose")}</option>
                  {choices
                    .filter((p) => !data.data?.partners.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {localized(p, "name", locale)}
                      </option>
                    ))}
                </SelectInput>
              )}
            </Field>
            <Button disabled={addPartner.isPending} type="submit">
              {t("addPartner")}
            </Button>
          </form>
        )}
        <ErrorLine error={addPartner.error} />
      </section>
    </div>
  );
};

// ── Program Report (Form F-25, section B) ───────────────────────────────────

const toNumber = (value: string) =>
  value.trim() === "" ? null : Number(value);

export const ReportTab = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions.reportTab");
  const locale = useLocale();
  const { supabase } = useAuth();
  const grants = useGrants();
  const queryClient = useQueryClient();
  const signer = useMemberNames([production.report_signed_by]);
  const [form, setForm] = useState({
    lessons: production.report_lessons ?? "",
    money_in: production.report_money_in_iqd?.toString() ?? "",
    money_out: production.report_money_out_iqd?.toString() ?? "",
    people: production.report_people_reached?.toString() ?? "",
    repeat: production.report_repeat ?? "",
    what: production.report_what_happened ?? "",
  });
  const [drafted, setDrafted] = useState<number | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: productionsKey });

  const save = useMutation({
    mutationFn: () =>
      productions.saveReport(supabase, production.id, {
        report_lessons: form.lessons,
        report_money_in_iqd: toNumber(form.money_in),
        report_money_out_iqd: toNumber(form.money_out),
        report_people_reached: Number(form.people),
        report_repeat: form.repeat,
        report_what_happened: form.what,
      }),
    onSuccess: refresh,
  });
  const sign = useMutation({
    mutationFn: () => productions.signReport(supabase, production.id),
    onSuccess: refresh,
  });
  const draft = useMutation({
    mutationFn: () => productions.draftCertificates(supabase, production.id),
    onSuccess: (count) => setDrafted(count),
  });

  const closed = production.stage === "closed";
  const signed = Boolean(production.report_signed_at);
  const canPrepare = hasPermission(grants.data, "certificates.prepare");
  const signerRow = signer.data?.[0];

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <p className="type-body">{t("lede")}</p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("people")}>
            {(id) => (
              <Input
                dir="ltr"
                disabled={signed}
                id={id}
                inputMode="numeric"
                min={0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, people: e.target.value }))
                }
                required
                type="number"
                value={form.people}
              />
            )}
          </Field>
          <Field hint={t("iqd")} label={t("moneyIn")}>
            {(id) => (
              <Input
                dir="ltr"
                disabled={signed}
                id={id}
                inputMode="numeric"
                min={0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, money_in: e.target.value }))
                }
                type="number"
                value={form.money_in}
              />
            )}
          </Field>
          <Field hint={t("iqd")} label={t("moneyOut")}>
            {(id) => (
              <Input
                dir="ltr"
                disabled={signed}
                id={id}
                inputMode="numeric"
                min={0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, money_out: e.target.value }))
                }
                type="number"
                value={form.money_out}
              />
            )}
          </Field>
        </div>
        <Field label={t("what")}>
          {(id) => (
            <Textarea
              dir="auto"
              disabled={signed}
              id={id}
              maxLength={4000}
              onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
              required
              rows={4}
              value={form.what}
            />
          )}
        </Field>
        <Field hint={t("lessonsHint")} label={t("lessons")}>
          {(id) => (
            <Textarea
              dir="auto"
              disabled={signed}
              id={id}
              maxLength={2000}
              onChange={(e) =>
                setForm((f) => ({ ...f, lessons: e.target.value }))
              }
              required
              rows={3}
              value={form.lessons}
            />
          )}
        </Field>
        <Field label={t("repeat")}>
          {(id) => (
            <Textarea
              dir="auto"
              disabled={signed}
              id={id}
              maxLength={2000}
              onChange={(e) =>
                setForm((f) => ({ ...f, repeat: e.target.value }))
              }
              required
              rows={2}
              value={form.repeat}
            />
          )}
        </Field>
        {signed ? null : (
          <SaveButton pending={save.isPending} success={save.isSuccess} />
        )}
        <ErrorLine error={save.error} />
      </form>

      <section className="grid gap-2">
        <h3 className="type-subheading">{t("signTitle")}</h3>
        {signed && production.report_signed_at ? (
          <p className="type-body">
            {t("signedBy", {
              date: formatLongDate(production.report_signed_at, locale),
              name: signerRow ? memberName(signerRow, locale) : "",
            })}
          </p>
        ) : (
          <>
            <p className="type-caption">
              {closed ? t("signHint") : t("closeFirst")}
            </p>
            <Button
              className="justify-self-start"
              disabled={!closed || sign.isPending}
              onClick={() => sign.mutate()}
            >
              {t("sign")}
            </Button>
            <ErrorLine error={sign.error} />
          </>
        )}
      </section>

      {canPrepare ? (
        <section className="grid gap-2">
          <h3 className="type-subheading">{t("certificatesTitle")}</h3>
          <p className="type-caption">{t("certificatesHint")}</p>
          <Button
            className="justify-self-start"
            disabled={!closed || draft.isPending}
            onClick={() => draft.mutate()}
            variant="outline"
          >
            {t("draftCertificates")}
          </Button>
          {drafted === null ? null : (
            <p className="type-body" role="status">
              {t("drafted", {
                count: drafted,
                countText: formatNumber(drafted),
              })}
            </p>
          )}
          <ErrorLine error={draft.error} />
        </section>
      ) : null}
    </div>
  );
};

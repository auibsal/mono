"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { formatLongDate } from "@repo/internationalization/format";
import { localized, partners, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { ErrorLine } from "../admin/kit";
import { EmptyLine, SectionSpinner } from "../states";

const KEY = ["declarations"];

type Kind = (typeof partners.conflictKinds)[number];

interface Item {
  affects: string;
  handling: string;
  partner_id: string;
  what: string;
}

const blankItem = (): Item => ({
  affects: "",
  handling: "",
  partner_id: "",
  what: "",
});

/**
 * Form F-18, Conflict of Interest Declaration (Policy Manual P8): every role
 * holder, every semester, and whenever something new arises. Received by
 * the General Secretary in Administration.
 */
export const Declarations = () => {
  const t = useTranslations("nexus.declarations");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Partial<Record<Kind, Item>>>({});
  const [nothing, setNothing] = useState(false);
  const [roleTitle, setRoleTitle] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [saved, setSaved] = useState(false);

  const history = useQuery({
    queryFn: () => partners.myDeclarations(supabase),
    queryKey: [...KEY, "mine"],
  });
  const partnerOptions = useQuery({
    queryFn: () => partners.declarablePartners(supabase),
    queryKey: [...KEY, "partners"],
  });
  const semesters = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("semesters")
          .select("id, name_en, name_ar, starts_on, ends_on")
          .order("starts_on", { ascending: false })
          .limit(4)
      ) ?? [],
    queryKey: [...KEY, "semesters"],
  });

  const submit = useMutation({
    mutationFn: () =>
      partners.declareConflicts(supabase, {
        items: Object.entries(checked).map(([kind, item]) => ({
          affects: item?.affects,
          handling: item?.handling,
          kind: kind as Kind,
          partner_id: item?.partner_id || null,
          what: item?.what ?? "",
        })),
        nothing_to_declare: nothing,
        role_title: roleTitle,
        semester_id: semesterId || null,
      }),
    onSuccess: async () => {
      setChecked({});
      setNothing(false);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
  const close = useMutation({
    mutationFn: (itemId: string) =>
      partners.closeConflictItem(supabase, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const setItem = (kind: Kind, patch: Partial<Item>) =>
    setChecked((current) => ({
      ...current,
      [kind]: { ...(current[kind] ?? blankItem()), ...patch },
    }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    submit.mutate();
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <FormHeader title={t("title")}>{t("lede")}</FormHeader>
      <p className="type-body">{t("definition")}</p>

      <form className="grid gap-5" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="declaration-role">{t("role")}</Label>
            <Input
              dir="auto"
              id="declaration-role"
              maxLength={200}
              onChange={(e) => setRoleTitle(e.target.value)}
              required
              value={roleTitle}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="declaration-semester">{t("semester")}</Label>
            <select
              className="frame h-10 bg-surface px-3"
              id="declaration-semester"
              onChange={(e) => setSemesterId(e.target.value)}
              value={semesterId}
            >
              <option value="">{t("chooseSemester")}</option>
              {(semesters.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {localized(s, "name", locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="grid gap-4" disabled={nothing}>
          <legend className="type-subheading mb-2">{t("question")}</legend>
          {partners.conflictKinds.map((kind) => {
            const item = checked[kind];
            return (
              <div className="grid gap-3" key={kind}>
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={Boolean(item)}
                    id={`conflict-${kind}`}
                    onCheckedChange={(on) =>
                      setChecked((current) => {
                        const next = { ...current };
                        if (on === true) {
                          next[kind] = blankItem();
                        } else {
                          delete next[kind];
                        }
                        return next;
                      })
                    }
                  />
                  <Label htmlFor={`conflict-${kind}`}>
                    {t(`kinds.${kind}`)}
                  </Label>
                </div>
                {item ? (
                  <div className="grid gap-3 ps-6">
                    {kind === "partner_role" ||
                    kind === "close_person_applying" ||
                    kind === "other" ? (
                      <div className="grid gap-2">
                        <Label htmlFor={`conflict-${kind}-partner`}>
                          {t("partner")}
                        </Label>
                        <select
                          className="frame h-10 bg-surface px-3"
                          id={`conflict-${kind}-partner`}
                          onChange={(e) =>
                            setItem(kind, { partner_id: e.target.value })
                          }
                          value={item.partner_id}
                        >
                          <option value="">{t("noPartner")}</option>
                          {(partnerOptions.data ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {localized(p, "name", locale)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {(["what", "affects", "handling"] as const).map((field) => (
                      <div className="grid gap-2" key={field}>
                        <Label htmlFor={`conflict-${kind}-${field}`}>
                          {t(`fields.${field}`)}
                        </Label>
                        <Textarea
                          dir="auto"
                          id={`conflict-${kind}-${field}`}
                          maxLength={1000}
                          onChange={(e) =>
                            setItem(kind, { [field]: e.target.value })
                          }
                          required={field === "what"}
                          rows={2}
                          value={item[field]}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        <div className="flex items-start gap-2">
          <Checkbox
            checked={nothing}
            id="conflict-nothing"
            onCheckedChange={(on) => {
              setNothing(on === true);
              if (on === true) {
                setChecked({});
              }
            }}
          />
          <Label htmlFor="conflict-nothing">{t("nothing")}</Label>
        </div>
        <p className="type-caption">{t("promise")}</p>
        <Button
          className="justify-self-start"
          disabled={
            submit.isPending || (!nothing && Object.keys(checked).length === 0)
          }
          type="submit"
        >
          {t("sign")}
        </Button>
        {saved ? <p role="status">{t("saved")}</p> : null}
        <ErrorLine error={submit.error} />
      </form>

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("history")}</h2>
        {history.isPending ? <SectionSpinner /> : null}
        {history.data?.length === 0 ? (
          <EmptyLine>{t("noHistory")}</EmptyLine>
        ) : null}
        <ul className="grid gap-3">
          {(history.data ?? []).map((d) => (
            <li key={d.id}>
              <SalCard>
                <p className="type-kicker">
                  {formatLongDate(d.signed_at, locale, true)}
                  {d.role_title ? ` · ${d.role_title}` : ""}
                </p>
                {d.nothing_to_declare ? (
                  <p className="type-body">{t("nothingDeclared")}</p>
                ) : (
                  <ul className="grid gap-2">
                    {d.conflict_items.map((item) => (
                      <li
                        className="flex flex-wrap items-start justify-between gap-2"
                        key={item.id}
                      >
                        <span>
                          <span className="font-medium">
                            {t(`kinds.${item.kind as Kind}`)}
                          </span>
                          {": "}
                          <span dir="auto">{item.what}</span>
                          {item.closed_on
                            ? ` (${t("closedOn", {
                                date: formatLongDate(
                                  item.closed_on,
                                  locale,
                                  true
                                ),
                              })})`
                            : ""}
                        </span>
                        {item.closed_on ? null : (
                          <Button
                            disabled={close.isPending}
                            onClick={() => close.mutate(item.id)}
                            size="sm"
                            variant="outline"
                          >
                            {t("close")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="type-caption">
                  {d.received_at
                    ? t("received", {
                        date: formatLongDate(d.received_at, locale, true),
                      })
                    : t("notReceived")}
                </p>
              </SalCard>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

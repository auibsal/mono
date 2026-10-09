"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { localized, productions, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SectionSpinner } from "../../states";
import {
  BilingualField,
  ConfirmAction,
  DateTimeField,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { MemberPicker, useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";
import { type ProductionRow, productionKey } from "./shared";

type Department = productions.Department;
type SignupStatus = productions.AuditionStatus;

const useNameOf = (ids: readonly (string | null | undefined)[]) => {
  const locale = useLocale() as Locale;
  const names = useMemberNames(ids);
  return (id: string | null) => {
    const row = names.data?.find((p) => p.id === id);
    return row ? memberName(row, locale) : "";
  };
};

const when = (row: { ends_at: string; starts_at: string }, locale: Locale) =>
  `${formatLongDate(row.starts_at, locale)} · ${formatClock(row.starts_at, locale)}–${formatClock(row.ends_at, locale)}`;

// ── Auditions ───────────────────────────────────────────────────────────────

const emptySlot = {
  capacity: "10",
  ends_at: null as string | null,
  location: { ar: "", en: "" },
  prepare: { ar: "", en: "" },
  starts_at: null as string | null,
};

export const AuditionsTab = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions.auditionsTab");
  const tp = useTranslations("nexus.productions");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const key = [...productionKey(production.id), "auditions"];
  const [form, setForm] = useState(emptySlot);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const data = useQuery({
    queryFn: async () => {
      const auditions =
        unwrap(
          await supabase
            .schema("programmes")
            .from("auditions")
            .select("*")
            .eq("production_id", production.id)
            .order("starts_at")
        ) ?? [];
      const ids = auditions.map((a) => a.id);
      const [signups, notes] = await Promise.all([
        supabase
          .schema("programmes")
          .from("audition_signups")
          .select("audition_id, user_id, status, interest")
          .in("audition_id", ids),
        supabase
          .schema("programmes")
          .from("audition_notes")
          .select("id, audition_id, user_id, author_id, note, created_at")
          .in("audition_id", ids)
          .order("created_at"),
      ]);
      return {
        auditions,
        notes: unwrap(notes) ?? [],
        signups: unwrap(signups) ?? [],
      };
    },
    queryKey: key,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const nameOf = useNameOf([
    ...(data.data?.signups ?? []).map((s) => s.user_id),
    ...(data.data?.notes ?? []).map((n) => n.author_id),
  ]);

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("auditions")
          .insert({
            capacity: Number(form.capacity),
            ends_at: form.ends_at ?? "",
            location_ar: form.location.ar.trim() || null,
            location_en: form.location.en.trim() || null,
            prepare_ar: form.prepare.ar.trim() || null,
            prepare_en: form.prepare.en.trim() || null,
            production_id: production.id,
            starts_at: form.starts_at ?? "",
          })
      ),
    onSuccess: async () => {
      setForm(emptySlot);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("auditions")
          .delete()
          .eq("id", id)
      ),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: async (input: {
      auditionId: string;
      status: SignupStatus;
      userId: string;
    }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("audition_signups")
          .update({ status: input.status })
          .eq("audition_id", input.auditionId)
          .eq("user_id", input.userId)
      ),
    onSuccess: refresh,
  });
  const note = useMutation({
    mutationFn: async (input: { auditionId: string; userId: string }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("audition_notes")
          .insert({
            audition_id: input.auditionId,
            note: drafts[`${input.auditionId}:${input.userId}`]?.trim() ?? "",
            user_id: input.userId,
          })
      ),
    onSuccess: async (_r, input) => {
      setDrafts((d) => ({ ...d, [`${input.auditionId}:${input.userId}`]: "" }));
      await refresh();
    },
  });

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <p className="type-body">{t("lede")}</p>
      {production.stage === "auditions" ? null : (
        <p className="type-caption">{t("openWhen")}</p>
      )}
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("add")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <DateTimeField
            label={t("starts")}
            onChange={(starts_at) => setForm((f) => ({ ...f, starts_at }))}
            required
            value={form.starts_at}
          />
          <DateTimeField
            label={t("ends")}
            onChange={(ends_at) => setForm((f) => ({ ...f, ends_at }))}
            required
            value={form.ends_at}
          />
          <Field label={t("capacity")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                inputMode="numeric"
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value }))
                }
                required
                type="number"
                value={form.capacity}
              />
            )}
          </Field>
        </div>
        <BilingualField
          label={t("location")}
          maxLength={200}
          onChange={(location) => setForm((f) => ({ ...f, location }))}
          value={form.location}
        />
        <BilingualField
          label={t("prepare")}
          maxLength={1000}
          multiline
          onChange={(prepare) => setForm((f) => ({ ...f, prepare }))}
          rows={2}
          value={form.prepare}
        />
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error} />
      </form>

      {data.isPending ? <SectionSpinner /> : null}
      {(data.data?.auditions ?? []).map((a) => {
        const people = (data.data?.signups ?? []).filter(
          (s) => s.audition_id === a.id
        );
        return (
          <section className="grid gap-3 border-rule border-t pt-4" key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="type-subheading">
                {when(a, locale)}
                {localized(a, "location", locale)
                  ? ` · ${localized(a, "location", locale)}`
                  : ""}
              </h3>
              <ConfirmAction
                confirmLabel={t("remove")}
                description={t("removeConfirm")}
                onConfirm={() => remove.mutate(a.id)}
                variant="ghost"
              >
                {t("remove")}
              </ConfirmAction>
            </div>
            {people.length === 0 ? (
              <p className="type-caption">{t("noSignups")}</p>
            ) : null}
            <ul className="grid gap-4">
              {people.map((s) => {
                const draftKey = `${a.id}:${s.user_id}`;
                return (
                  <li className="grid gap-2" key={s.user_id}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{nameOf(s.user_id)}</span>
                      <SelectInput
                        aria-label={t("status")}
                        className="w-auto"
                        onChange={(e) =>
                          decide.mutate({
                            auditionId: a.id,
                            status: e.target.value as SignupStatus,
                            userId: s.user_id,
                          })
                        }
                        value={s.status}
                      >
                        {productions.auditionStatuses.map((status) => (
                          <option key={status} value={status}>
                            {tp(`statuses.${status}`)}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    {s.interest ? (
                      <p className="type-caption" dir="auto">
                        {s.interest}
                      </p>
                    ) : null}
                    <ul className="grid gap-1">
                      {(data.data?.notes ?? [])
                        .filter(
                          (n) =>
                            n.audition_id === a.id && n.user_id === s.user_id
                        )
                        .map((n) => (
                          <li className="type-body" dir="auto" key={n.id}>
                            {n.note}{" "}
                            <span className="type-caption">
                              · {nameOf(n.author_id)}
                            </span>
                          </li>
                        ))}
                    </ul>
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        note.mutate({ auditionId: a.id, userId: s.user_id });
                      }}
                    >
                      <Input
                        aria-label={t("note")}
                        className="max-w-md"
                        dir="auto"
                        maxLength={2000}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [draftKey]: e.target.value,
                          }))
                        }
                        placeholder={t("notePlaceholder")}
                        required
                        value={drafts[draftKey] ?? ""}
                      />
                      <Button
                        disabled={note.isPending}
                        size="sm"
                        type="submit"
                        variant="outline"
                      >
                        {t("addNote")}
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="type-caption">{t("notesPrivate")}</p>
    </div>
  );
};

// ── Credits ─────────────────────────────────────────────────────────────────

interface Person {
  full_name_ar: string | null;
  full_name_en: string;
  id: string;
}

const emptyCredit = {
  department: "cast" as Department,
  member: null as Person | null,
  person_name: "",
  role: { ar: "", en: "" },
  who: "member" as "member" | "outside",
};

export const CreditsTab = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions.creditsTab");
  const tp = useTranslations("nexus.productions");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const key = [...productionKey(production.id), "credits"];
  const [form, setForm] = useState(emptyCredit);
  const [hours, setHours] = useState<Record<string, string>>({});
  const [recorded, setRecorded] = useState<string | null>(null);

  const credits = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_credits")
          .select("*")
          .eq("production_id", production.id)
          .order("department")
          .order("sort")
      ) ?? [],
    queryKey: key,
  });
  const nameOf = useNameOf((credits.data ?? []).map((c) => c.user_id));
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () =>
      productions.addCredit(supabase, production.id, {
        department: form.department,
        person_name: form.who === "outside" ? form.person_name : null,
        role_ar: form.role.ar,
        role_en: form.role.en,
        user_id: form.who === "member" ? (form.member?.id ?? null) : null,
      }),
    onSuccess: async () => {
      setForm(emptyCredit);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_credits")
          .delete()
          .eq("id", id)
      ),
    onSuccess: refresh,
  });
  const showOutside = useMutation({
    mutationFn: async (input: { id: string; visible: boolean }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("production_credits")
          .update({ show_publicly: input.visible })
          .eq("id", input.id)
      ),
    onSuccess: refresh,
  });
  const record = useMutation({
    mutationFn: (userId: string) =>
      productions.recordService(
        supabase,
        production.id,
        userId,
        Number(hours[userId])
      ),
    onSuccess: (_r, userId) => setRecorded(userId),
  });

  const started = !["proposal", "approved", "cancelled"].includes(
    production.stage
  );

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <p className="type-body">{t("lede")}</p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("add")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("department")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    department: e.target.value as Department,
                  }))
                }
                value={form.department}
              >
                {productions.departments.map((d) => (
                  <option key={d} value={d}>
                    {tp(`departments.${d}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("who")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    who: e.target.value as "member" | "outside",
                  }))
                }
                value={form.who}
              >
                <option value="member">{t("aMember")}</option>
                <option value="outside">{t("someoneOutside")}</option>
              </SelectInput>
            )}
          </Field>
        </div>
        {form.who === "member" ? (
          <MemberPicker
            label={t("member")}
            onChange={(member) => setForm((f) => ({ ...f, member }))}
            value={form.member}
          />
        ) : (
          <Field hint={t("outsideHint")} label={t("personName")}>
            {(id) => (
              <Input
                dir="auto"
                id={id}
                maxLength={200}
                onChange={(e) =>
                  setForm((f) => ({ ...f, person_name: e.target.value }))
                }
                required
                value={form.person_name}
              />
            )}
          </Field>
        )}
        <BilingualField
          label={t("role")}
          maxLength={200}
          onChange={(role) => setForm((f) => ({ ...f, role }))}
          value={form.role}
        />
        <SaveButton
          disabled={form.who === "member" && !form.member}
          pending={add.isPending}
        />
        <ErrorLine error={add.error} />
      </form>

      {credits.isPending ? <SectionSpinner /> : null}
      {credits.data?.length === 0 ? (
        <p className="type-caption">{t("none")}</p>
      ) : null}
      <ul className="grid gap-4">
        {(credits.data ?? []).map((c) => (
          <li className="grid gap-2 border-rule border-b pb-3" key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium" dir="auto">
                  {c.person_name ?? nameOf(c.user_id)}
                </span>
                <span className="type-caption">
                  {" · "}
                  {tp(`departments.${c.department as Department}`)} ·{" "}
                  {localized(c, "role", locale)}
                </span>
              </span>
              <ConfirmAction
                confirmLabel={t("remove")}
                description={t("removeConfirm")}
                onConfirm={() => remove.mutate(c.id)}
                variant="ghost"
              >
                {t("remove")}
              </ConfirmAction>
            </div>
            {c.user_id ? (
              <p className="type-caption">
                {c.show_publicly ? t("shown") : t("notShown")}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={c.show_publicly}
                  id={`outside-${c.id}`}
                  onCheckedChange={(checked) =>
                    showOutside.mutate({ id: c.id, visible: checked === true })
                  }
                />
                <Label htmlFor={`outside-${c.id}`}>{t("showOutside")}</Label>
              </div>
            )}
            {c.user_id && started && c.user_id !== user?.id ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (c.user_id) {
                    record.mutate(c.user_id);
                  }
                }}
              >
                <Field label={t("hours")}>
                  {(id) => (
                    <Input
                      className="w-28"
                      dir="ltr"
                      id={id}
                      inputMode="decimal"
                      max={24}
                      min={0.25}
                      onChange={(e) =>
                        setHours((h) => ({
                          ...h,
                          [c.user_id ?? ""]: e.target.value,
                        }))
                      }
                      required
                      step={0.25}
                      type="number"
                      value={hours[c.user_id ?? ""] ?? ""}
                    />
                  )}
                </Field>
                <Button
                  disabled={record.isPending}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  {t("recordHours")}
                </Button>
                {recorded === c.user_id ? (
                  <span className="type-caption" role="status">
                    {t("recorded")}
                  </span>
                ) : null}
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <ErrorLine error={record.error ?? remove.error} />
    </div>
  );
};

// ── Rehearsals ──────────────────────────────────────────────────────────────

const emptyRehearsal = {
  called: "",
  ends_at: null as string | null,
  location: { ar: "", en: "" },
  notes: "",
  starts_at: null as string | null,
};

export const RehearsalsTab = ({
  production,
}: {
  production: ProductionRow;
}) => {
  const t = useTranslations("nexus.admin.productions.rehearsalsTab");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const key = [...productionKey(production.id), "rehearsals"];
  const [form, setForm] = useState(emptyRehearsal);

  const rehearsals = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("rehearsals")
          .select("*")
          .eq("production_id", production.id)
          .order("starts_at")
      ) ?? [],
    queryKey: key,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("rehearsals")
          .insert({
            called: form.called.trim() || null,
            ends_at: form.ends_at ?? "",
            location_ar: form.location.ar.trim() || null,
            location_en: form.location.en.trim() || null,
            notes: form.notes.trim() || null,
            production_id: production.id,
            starts_at: form.starts_at ?? "",
          })
      ),
    onSuccess: async () => {
      setForm(emptyRehearsal);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("rehearsals")
          .delete()
          .eq("id", id)
      ),
    onSuccess: refresh,
  });

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <p className="type-body">{t("lede")}</p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("add")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label={t("starts")}
            onChange={(starts_at) => setForm((f) => ({ ...f, starts_at }))}
            required
            value={form.starts_at}
          />
          <DateTimeField
            label={t("ends")}
            onChange={(ends_at) => setForm((f) => ({ ...f, ends_at }))}
            required
            value={form.ends_at}
          />
        </div>
        <BilingualField
          label={t("location")}
          maxLength={200}
          onChange={(location) => setForm((f) => ({ ...f, location }))}
          value={form.location}
        />
        <Field hint={t("calledHint")} label={t("called")}>
          {(id) => (
            <Input
              dir="auto"
              id={id}
              maxLength={500}
              onChange={(e) =>
                setForm((f) => ({ ...f, called: e.target.value }))
              }
              value={form.called}
            />
          )}
        </Field>
        <Field label={t("notes")}>
          {(id) => (
            <Input
              dir="auto"
              id={id}
              maxLength={2000}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              value={form.notes}
            />
          )}
        </Field>
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error} />
      </form>
      {rehearsals.isPending ? <SectionSpinner /> : null}
      {rehearsals.data?.length === 0 ? (
        <p className="type-caption">{t("none")}</p>
      ) : null}
      <ul className="grid gap-2">
        {(rehearsals.data ?? []).map((r) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 border-rule border-b pb-2"
            key={r.id}
          >
            <span className="grid">
              <span className="font-medium">{when(r, locale)}</span>
              <span className="type-caption" dir="auto">
                {[localized(r, "location", locale), r.called, r.notes]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <ConfirmAction
              confirmLabel={t("remove")}
              description={t("removeConfirm")}
              onConfirm={() => remove.mutate(r.id)}
              variant="ghost"
            >
              {t("remove")}
            </ConfirmAction>
          </li>
        ))}
      </ul>
    </div>
  );
};

"use client";

import { useAuth } from "@repo/auth/provider";
import type { Json } from "@repo/database";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import {
  formatDateTime,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  ConfirmAction,
  ErrorLine,
  Field,
  SaveButton,
} from "../kit";
import { ThirdPartyApps } from "./apps";
import { NotionWorkspace } from "./notion";

const key = ["admin", "settings"];
const SEMESTER_CODE = /^(fall|spring|summer)-\d{4}$/;

const useSettings = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const rows =
        unwrap(
          await supabase.schema("core").from("settings").select("key, value")
        ) ?? [];
      const settings: Record<string, Json> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return settings;
    },
    queryKey: key,
  });
};

const useSaveSetting = () => {
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Record<string, NonNullable<Json>>) => {
      const results = await Promise.all(
        Object.entries(entries).map(([settingKey, value]) =>
          supabase
            .schema("core")
            .from("settings")
            .update({ updated_by: user?.id ?? null, value })
            .eq("key", settingKey)
        )
      );
      for (const result of results) {
        unwrap(result);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
};

const asText = (value: Json | undefined) =>
  typeof value === "string" ? value : "";

const Section = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <SalCard>
    <h2 className="type-subheading">{title}</h2>
    {children}
  </SalCard>
);

// ── Semesters and blackouts ─────────────────────────────────────────────────

const Semesters = () => {
  const t = useTranslations("nexus.admin.settings");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    ends_on: "",
    name: { ar: "", en: "" },
    starts_on: "",
  });
  const [blackout, setBlackout] = useState({
    ends_on: "",
    label: { ar: "", en: "" },
    semester_id: "",
    starts_on: "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const data = useQuery({
    queryFn: async () => {
      const [semesters, blackouts] = await Promise.all([
        supabase
          .schema("core")
          .from("semesters")
          .select("*")
          .order("starts_on", { ascending: false }),
        supabase
          .schema("core")
          .from("blackouts")
          .select("*")
          .order("starts_on"),
      ]);
      return {
        blackouts: unwrap(blackouts) ?? [],
        semesters: unwrap(semesters) ?? [],
      };
    },
    queryKey: [...key, "semesters"],
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...key, "semesters"] });
  const addSemester = useMutation({
    mutationFn: async () => {
      if (!SEMESTER_CODE.test(form.code)) {
        setProblem(t("codeError"));
        throw new Error("invalid");
      }
      setProblem(null);
      unwrap(
        await supabase.schema("core").from("semesters").insert({
          code: form.code,
          ends_on: form.ends_on,
          name_ar: form.name.ar,
          name_en: form.name.en,
          starts_on: form.starts_on,
        })
      );
    },
    onSuccess: async () => {
      setForm({
        code: "",
        ends_on: "",
        name: { ar: "", en: "" },
        starts_on: "",
      });
      await invalidate();
    },
  });
  const removeSemester = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase.schema("core").from("semesters").delete().eq("id", id)
      ),
    onSuccess: invalidate,
  });
  const addBlackout = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("core").from("blackouts").insert({
          ends_on: blackout.ends_on,
          label_ar: blackout.label.ar,
          label_en: blackout.label.en,
          semester_id: blackout.semester_id,
          starts_on: blackout.starts_on,
        })
      ),
    onSuccess: async () => {
      setBlackout((b) => ({
        ...b,
        ends_on: "",
        label: { ar: "", en: "" },
        starts_on: "",
      }));
      await invalidate();
    },
  });
  const removeBlackout = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase.schema("core").from("blackouts").delete().eq("id", id)
      ),
    onSuccess: invalidate,
  });

  return (
    <Section title={t("semesters")}>
      <p className="type-caption">{t("semesterHint")}</p>
      {data.isPending ? <SectionSpinner /> : null}
      {data.data?.semesters.length === 0 ? (
        <p className="font-bold text-title">{t("noSemesters")}</p>
      ) : null}
      <ul className="grid gap-3">
        {data.data?.semesters.map((s) => (
          <li className="grid gap-1 border-rule border-b pb-3" key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-bold">
                  {localized(s, "name", locale)}
                </span>{" "}
                <span className="type-code text-xs">{s.code}</span> ·{" "}
                {formatLongDate(s.starts_on, locale, true)} –{" "}
                {formatLongDate(s.ends_on, locale, true)}
              </p>
              <ConfirmAction
                confirmLabel={t("remove")}
                description={t("removeConfirm")}
                disabled={removeSemester.isPending}
                onConfirm={() => removeSemester.mutate(s.id)}
                variant="ghost"
              >
                {t("remove")}
              </ConfirmAction>
            </div>
            <ul className="grid gap-1 ps-4">
              {data.data.blackouts
                .filter((b) => b.semester_id === s.id)
                .map((b) => (
                  <li
                    className="type-caption flex flex-wrap items-center gap-3"
                    key={b.id}
                  >
                    {localized(b, "label", locale)} ·{" "}
                    {formatLongDate(b.starts_on, locale)} –{" "}
                    {formatLongDate(b.ends_on, locale)}
                    <ConfirmAction
                      confirmLabel={t("remove")}
                      description={t("removeConfirm")}
                      disabled={removeBlackout.isPending}
                      onConfirm={() => removeBlackout.mutate(b.id)}
                      variant="ghost"
                    >
                      {t("remove")}
                    </ConfirmAction>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          addSemester.mutate();
        }}
      >
        <h3 className="font-bold text-sm">{t("addSemester")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("code")}>
            {(id) => (
              <Input
                className="type-code"
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                required
                value={form.code}
              />
            )}
          </Field>
          <Field label={t("startsOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, starts_on: e.target.value }))
                }
                required
                type="date"
                value={form.starts_on}
              />
            )}
          </Field>
          <Field label={t("endsOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ends_on: e.target.value }))
                }
                required
                type="date"
                value={form.ends_on}
              />
            )}
          </Field>
        </div>
        <BilingualField
          label={t("name")}
          maxLength={80}
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          required
          value={form.name}
        />
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        <SaveButton pending={addSemester.isPending} />
        {addSemester.error && addSemester.error.message !== "invalid" ? (
          <ErrorLine error={addSemester.error} />
        ) : null}
      </form>
      {data.data && data.data.semesters.length > 0 ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            addBlackout.mutate();
          }}
        >
          <h3 className="font-bold text-sm">{t("addBlackout")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("semesters")}>
              {(id) => (
                <select
                  className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm"
                  id={id}
                  onChange={(e) =>
                    setBlackout((b) => ({ ...b, semester_id: e.target.value }))
                  }
                  required
                  value={blackout.semester_id}
                >
                  <option value="" />
                  {data.data.semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {localized(s, "name", locale)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("startsOn")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setBlackout((b) => ({ ...b, starts_on: e.target.value }))
                  }
                  required
                  type="date"
                  value={blackout.starts_on}
                />
              )}
            </Field>
            <Field label={t("endsOn")}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setBlackout((b) => ({ ...b, ends_on: e.target.value }))
                  }
                  required
                  type="date"
                  value={blackout.ends_on}
                />
              )}
            </Field>
          </div>
          <BilingualField
            label={t("label")}
            maxLength={80}
            onChange={(label) => setBlackout((b) => ({ ...b, label }))}
            required
            value={blackout.label}
          />
          <SaveButton pending={addBlackout.isPending} />
          <ErrorLine
            error={
              addBlackout.error ?? removeBlackout.error ?? removeSemester.error
            }
          />
        </form>
      ) : null}
    </Section>
  );
};

// ── Simple settings ─────────────────────────────────────────────────────────

const JournalName = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings");
  const save = useSaveSetting();
  const [name, setName] = useState({ ar: "", en: "" });
  useEffect(() => {
    setName({
      ar: asText(settings["journal.name_ar"]),
      en: asText(settings["journal.name_en"]),
    });
  }, [settings]);
  return (
    <Section title={t("journal")}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            "journal.name_ar": name.ar,
            "journal.name_en": name.en,
          });
        }}
      >
        <BilingualField
          label={t("journal")}
          maxLength={60}
          onChange={setName}
          required
          value={name}
        />
        <p className="type-caption">{t("journalHint")}</p>
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </Section>
  );
};

const SocietyContacts = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings.contacts");
  const save = useSaveSetting();
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [advisor, setAdvisor] = useState({ ar: "", en: "" });
  useEffect(() => {
    setEmail(asText(settings["contact.email"]));
    setTelegram(asText(settings["contact.telegram_url"]));
    setAdvisor({
      ar: asText(settings["society.faculty_advisor_ar"]),
      en: asText(settings["society.faculty_advisor_en"]),
    });
  }, [settings]);
  const telegramOk = telegram === "" || telegram.startsWith("https://t.me/");
  return (
    <Section title={t("title")}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!telegramOk) {
            return;
          }
          save.mutate({
            "contact.email": email.trim(),
            "contact.telegram_url": telegram.trim(),
            "society.faculty_advisor_ar": advisor.ar.trim(),
            "society.faculty_advisor_en": advisor.en.trim(),
          });
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="contact-email">{t("email")}</Label>
          <Input
            dir="ltr"
            id="contact-email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-telegram">{t("telegram")}</Label>
          <Input
            aria-invalid={!telegramOk}
            dir="ltr"
            id="contact-telegram"
            onChange={(event) => setTelegram(event.target.value)}
            placeholder={t("telegramPlaceholder")}
            type="url"
            value={telegram}
          />
          {telegramOk ? null : (
            <p className="text-sm text-title" role="alert">
              {t("telegramInvalid")}
            </p>
          )}
        </div>
        <BilingualField
          label={t("advisor")}
          maxLength={120}
          onChange={setAdvisor}
          value={advisor}
        />
        <p className="type-caption">{t("hint")}</p>
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </Section>
  );
};

const CampusCalendar = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const save = useSaveSetting();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(asText(settings["auib.calendar_url"])), [settings]);
  const sync = useQuery({
    queryFn: async () => {
      const { count } = await supabase
        .schema("events")
        .from("campus_events")
        .select("id", { count: "exact", head: true });
      const latest = unwrap(
        await supabase
          .schema("events")
          .from("campus_events")
          .select("fetched_at")
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      );
      return { count: count ?? 0, fetchedAt: latest?.fetched_at ?? null };
    },
    queryKey: [...key, "campus-sync"],
  });
  return (
    <Section title={t("calendar")}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // An empty string clears it (the column is non-null JSON).
          save.mutate({ "auib.calendar_url": url.trim() });
        }}
      >
        <Field hint={t("calendarHint")} label={t("calendar")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              value={url}
            />
          )}
        </Field>
        <p className="type-caption" role="status">
          {sync.data?.fetchedAt
            ? t("lastSync", {
                count: formatNumber(sync.data.count),
                time: formatDateTime(sync.data.fetchedAt, locale),
              })
            : t("neverSynced")}
        </p>
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </Section>
  );
};

const WinterSetCost = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings");
  const save = useSaveSetting();
  const [cost, setCost] = useState("");
  useEffect(
    () => setCost(String(settings["charity.cost_per_winter_set_iqd"] ?? "")),
    [settings]
  );
  return (
    <Section title={t("cost")}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ "charity.cost_per_winter_set_iqd": Number(cost) });
        }}
      >
        <Field hint={t("costHint")} label={t("cost")}>
          {(id) => (
            <Input
              className="w-48"
              dir="ltr"
              id={id}
              min={1}
              onChange={(e) => setCost(e.target.value)}
              required
              type="number"
              value={cost}
            />
          )}
        </Field>
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </Section>
  );
};

const VERSION_KEYS = [
  ["pledges.human_authorship.version", "humanAuthorship"],
  ["pledges.member.version", "memberPledge"],
  ["journal.agreement.version", "agreement"],
] as const;

const Versions = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings");
  const save = useSaveSetting();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setValues(
      Object.fromEntries(VERSION_KEYS.map(([k]) => [k, asText(settings[k])]))
    );
  }, [settings]);
  return (
    <Section title={t("pledges")}>
      <p className="type-caption">{t("pledgesHint")}</p>
      <ul className="grid gap-3">
        {VERSION_KEYS.map(([settingKey, label]) => (
          <li className="flex flex-wrap items-end gap-3" key={settingKey}>
            <Field className="w-56" label={t(label)}>
              {(id) => (
                <Input
                  dir="ltr"
                  id={id}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [settingKey]: e.target.value }))
                  }
                  pattern="[0-9]+(\.[0-9]+)*"
                  value={values[settingKey] ?? ""}
                />
              )}
            </Field>
            <ConfirmAction
              confirmLabel={t("pledges")}
              description={t("versionConfirm", {
                version: values[settingKey] ?? "",
              })}
              disabled={
                save.isPending ||
                values[settingKey] === asText(settings[settingKey])
              }
              onConfirm={() =>
                save.mutate({ [settingKey]: values[settingKey] ?? "" })
              }
            >
              {t("pledges")}
            </ConfirmAction>
          </li>
        ))}
      </ul>
      <ErrorLine error={save.error} />
    </Section>
  );
};

const Flags = ({ settings }: { settings: Record<string, Json> }) => {
  const t = useTranslations("nexus.admin.settings");
  const save = useSaveSetting();
  const on = settings["features.elections"] === true;
  return (
    <Section title={t("flags")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">
            {t("elections")}: {on ? t("on") : t("off")}
          </p>
          <p className="type-caption">{t("electionsHint")}</p>
        </div>
        <ConfirmAction
          confirmLabel={on ? t("turnOff") : t("turnOn")}
          description={t("flagConfirm")}
          disabled={save.isPending}
          onConfirm={() => save.mutate({ "features.elections": !on })}
        >
          {on ? t("turnOff") : t("turnOn")}
        </ConfirmAction>
      </div>
      <ErrorLine error={save.error} />
    </Section>
  );
};

export const SettingsAdmin = () => {
  const t = useTranslations("nexus.admin.settings");
  const settings = useSettings();
  if (settings.isPending) {
    return <SectionSpinner />;
  }
  const values = settings.data ?? {};
  return (
    <div className="grid gap-gap">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Semesters />
      <JournalName settings={values} />
      <SocietyContacts settings={values} />
      <CampusCalendar settings={values} />
      <WinterSetCost settings={values} />
      <Versions settings={values} />
      <Flags settings={values} />
      <NotionWorkspace />
      <ThirdPartyApps />
      <p className="type-caption">{t("banner")}</p>
      <p className="type-caption">{t("emails")}</p>
    </div>
  );
};

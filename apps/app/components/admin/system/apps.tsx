"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { SectionSpinner } from "../../states";
import { ConfirmAction, DataTable, ErrorLine, Field, SaveButton } from "../kit";

const AREAS = [
  "profile",
  "journal",
  "events",
  "programmes",
  "content",
] as const;
type Area = (typeof AREAS)[number];

const key = ["admin", "oauth-clients"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const empty = { client_id: "", contact_email: "", name_en: "" };

/**
 * Settings: third-party apps approved for Sign in with SAL. The app is
 * first registered in Supabase (Authentication → OAuth Apps), which issues
 * the client id; listing it here decides what it may reach. The database
 * enforces it (migration 20261008001500).
 */
export const ThirdPartyApps = () => {
  const t = useTranslations("nexus.admin.settings.apps");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const [form, setForm] = useState(empty);
  const [areas, setAreas] = useState<Area[]>(["profile"]);

  const apps = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("access")
          .from("oauth_clients")
          .select(
            "client_id, name_en, contact_email, areas, enabled, created_at"
          )
          .order("created_at")
      ),
    queryKey: key,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.schema("access").from("oauth_clients").insert({
          areas,
          client_id: form.client_id.trim().toLowerCase(),
          contact_email: form.contact_email.trim(),
          name_en: form.name_en.trim(),
        })
      ),
    onSuccess: () => {
      setForm(empty);
      setAreas(["profile"]);
      return refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: async (app: { client_id: string; enabled: boolean }) =>
      unwrap(
        await supabase
          .schema("access")
          .from("oauth_clients")
          .update({ enabled: !app.enabled })
          .eq("client_id", app.client_id)
      ),
    onSuccess: refresh,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (UUID.test(form.client_id.trim()) && form.name_en.trim()) {
      add.mutate();
    }
  };

  return (
    <SalCard>
      <h2 className="type-subheading">{t("title")}</h2>
      <p className="type-body">{t("hint")}</p>
      {apps.isPending ? (
        <SectionSpinner />
      ) : (
        <DataTable
          caption={t("title")}
          columns={[
            { cell: (a) => a.name_en, header: t("name"), key: "name" },
            {
              cell: (a) =>
                a.areas
                  .filter((area): area is Area =>
                    (AREAS as readonly string[]).includes(area)
                  )
                  .map((area) => t(`areas.${area}`))
                  .join(", "),
              header: t("areasLabel"),
              key: "areas",
            },
            {
              cell: (a) => <span dir="ltr">{a.contact_email}</span>,
              header: t("contact"),
              key: "contact",
            },
            {
              cell: (a) => (
                <ConfirmAction
                  confirmLabel={a.enabled ? t("switchOff") : t("switchOn")}
                  description={
                    a.enabled ? t("switchOffConfirm") : t("switchOnConfirm")
                  }
                  disabled={toggle.isPending}
                  onConfirm={() => toggle.mutate(a)}
                >
                  {a.enabled ? t("switchOff") : t("switchOn")}
                </ConfirmAction>
              ),
              header: t("status"),
              key: "status",
            },
          ]}
          empty={t("none")}
          rowKey={(a) => a.client_id}
          rows={apps.data ?? []}
        />
      )}
      <ErrorLine error={apps.error ?? toggle.error} />
      <form className="grid gap-4" onSubmit={submit}>
        <h3 className="font-bold">{t("add")}</h3>
        <Field hint={t("clientIdHint")} label={t("clientId")}>
          {(fieldId) => (
            <Input
              dir="ltr"
              id={fieldId}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
              pattern={UUID.source}
              required
              value={form.client_id}
            />
          )}
        </Field>
        <Field label={t("name")}>
          {(fieldId) => (
            <Input
              id={fieldId}
              maxLength={120}
              onChange={(e) =>
                setForm((f) => ({ ...f, name_en: e.target.value }))
              }
              required
              value={form.name_en}
            />
          )}
        </Field>
        <Field label={t("contact")}>
          {(fieldId) => (
            <Input
              dir="ltr"
              id={fieldId}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
              required
              type="email"
              value={form.contact_email}
            />
          )}
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-medium text-sm">
            {t("areasLabel")}
          </legend>
          {AREAS.map((area) => (
            <div className="flex items-start gap-3" key={area}>
              <Checkbox
                checked={areas.includes(area)}
                id={`${id}-${area}`}
                onCheckedChange={(v) =>
                  setAreas((current) =>
                    v === true
                      ? [...current, area]
                      : current.filter((a) => a !== area)
                  )
                }
              />
              <Label className="leading-normal" htmlFor={`${id}-${area}`}>
                {t(`areas.${area}`)}
              </Label>
            </div>
          ))}
          <p className="type-caption">{t("never")}</p>
        </fieldset>
        <ErrorLine error={add.error} />
        <SaveButton pending={add.isPending} success={add.isSuccess} />
      </form>
    </SalCard>
  );
};

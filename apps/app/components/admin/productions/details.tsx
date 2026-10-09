"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { formatLongDate } from "@repo/internationalization/format";
import { localized, productions, unwrap } from "@repo/sal-data";
import { uploadLibraryFile } from "@repo/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { callApi } from "@/lib/api";
import { ImageField } from "../image-field";
import {
  BilingualField,
  ConfirmAction,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { type ProductionRow, productionsKey } from "./shared";

type Stage = productions.ProductionStage;
type Kind = productions.ProductionKind;
type Origin = productions.ScriptOrigin;

const useSave = () => {
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      changes: Partial<ProductionRow>;
      id: string;
    }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("productions")
          .update(input.changes)
          .eq("id", input.id)
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productionsKey }),
  });
};

export const DetailsTab = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions");
  const locale = useLocale();
  const { supabase } = useAuth();
  const save = useSave();
  const [form, setForm] = useState({
    is_public: production.is_public,
    kind: production.kind as Kind,
    playwright: production.playwright ?? "",
    poster_path: production.poster_path,
    programme_id: production.programme_id ?? "",
    summary: {
      ar: production.summary_ar ?? "",
      en: production.summary_en ?? "",
    },
    title: { ar: production.title_ar, en: production.title_en },
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
    queryKey: ["admin", "programmes", "names"],
  });

  const stage = production.stage as Stage;
  const next = productions.nextStage(stage);
  const blocked =
    next !== null &&
    productions.needsRights(next) &&
    production.rights_status !== "cleared";
  const finished = stage === "closed" || stage === "cancelled";

  return (
    <div className="grid max-w-3xl gap-8 pt-4">
      <div className="grid gap-3">
        <p className="type-kicker">{t("stageNow")}</p>
        <p className="font-bold text-xl">{t(`stages.${stage}`)}</p>
        {finished ? null : (
          <div className="flex flex-wrap items-center gap-3">
            {next ? (
              <Button
                disabled={blocked || save.isPending}
                onClick={() =>
                  save.mutate({ changes: { stage: next }, id: production.id })
                }
                size="sm"
              >
                {t("moveTo", { stage: t(`stages.${next}`) })}
              </Button>
            ) : null}
            <ConfirmAction
              confirmLabel={t("cancelProduction")}
              description={t("cancelConfirm")}
              disabled={save.isPending}
              onConfirm={() =>
                save.mutate({
                  changes: { stage: "cancelled" },
                  id: production.id,
                })
              }
              variant="ghost"
            >
              {t("cancelProduction")}
            </ConfirmAction>
          </div>
        )}
        {blocked ? <p className="type-caption">{t("rightsFirst")}</p> : null}
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            changes: {
              is_public: form.is_public,
              kind: form.kind,
              playwright: form.playwright.trim() || null,
              poster_path: form.poster_path,
              programme_id: form.programme_id || null,
              summary_ar: form.summary.ar.trim() || null,
              summary_en: form.summary.en.trim() || null,
              title_ar: form.title.ar.trim(),
              title_en: form.title.en.trim(),
            },
            id: production.id,
          });
        }}
      >
        <BilingualField
          label={t("fields.title")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <BilingualField
          label={t("fields.summary")}
          maxLength={1000}
          multiline
          onChange={(summary) => setForm((f) => ({ ...f, summary }))}
          rows={3}
          value={form.summary}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("fields.playwright")}>
            {(id) => (
              <Input
                dir="auto"
                id={id}
                maxLength={200}
                onChange={(e) =>
                  setForm((f) => ({ ...f, playwright: e.target.value }))
                }
                value={form.playwright}
              />
            )}
          </Field>
          <Field label={t("fields.kind")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as Kind }))
                }
                value={form.kind}
              >
                {productions.productionKinds.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("fields.programme")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programme_id: e.target.value }))
                }
                value={form.programme_id}
              >
                <option value="">{t("fields.noProgramme")}</option>
                {(programmes.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {localized(p, "name", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <ImageField
          area="productions"
          label={t("fields.poster")}
          onChange={(poster_path) => setForm((f) => ({ ...f, poster_path }))}
          value={form.poster_path}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.is_public}
            id={`public-${production.id}`}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, is_public: checked === true }))
            }
          />
          <Label htmlFor={`public-${production.id}`}>
            {t("fields.isPublic")}
          </Label>
        </div>
        <p className="type-caption">{t("fields.isPublicHint")}</p>
        <SaveButton pending={save.isPending} success={save.isSuccess} />
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

export const RightsTab = ({ production }: { production: ProductionRow }) => {
  const t = useTranslations("nexus.admin.productions.rightsTab");
  const tp = useTranslations("nexus.admin.productions");
  const locale = useLocale();
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const save = useSave();
  const [origin, setOrigin] = useState(production.script_origin as Origin);
  const [note, setNote] = useState(production.rights_note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const locked =
    production.stage === "performances" || production.stage === "closed";

  const record = useMutation({
    mutationFn: async () => {
      const path = file
        ? (await uploadLibraryFile(supabase, "productions", file)).path
        : production.rights_document_path;
      await save.mutateAsync({
        changes: {
          rights_document_path: path,
          rights_note: note.trim() || null,
          script_origin: origin,
        },
        id: production.id,
      });
    },
    onSuccess: () => setFile(null),
  });
  const clear = useMutation({
    mutationFn: () => productions.clearRights(supabase, production.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productionsKey }),
  });
  const open = async () => {
    const { url } = await callApi<{ url: string }>(supabase, "/files/rights", {
      id: production.id,
    });
    window.open(url, "_blank", "noopener");
  };

  const cleared = production.rights_status === "cleared";
  const recordedByMe = production.rights_recorded_by === user?.id;

  return (
    <div className="grid max-w-3xl gap-6 pt-4">
      <p className="type-body">{t("lede")}</p>
      <div className="grid gap-1">
        <p className="type-kicker">{t("status")}</p>
        <p className="font-bold">
          {tp(`rights.${cleared ? "cleared" : "pending"}`)}
          {cleared && production.rights_cleared_at
            ? ` · ${formatLongDate(production.rights_cleared_at, locale)}`
            : ""}
        </p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          record.mutate();
        }}
      >
        <Field label={tp("fields.origin")}>
          {(fieldId) => (
            <SelectInput
              disabled={locked}
              id={fieldId}
              onChange={(e) => setOrigin(e.target.value as Origin)}
              value={origin}
            >
              {productions.scriptOrigins.map((o) => (
                <option key={o} value={o}>
                  {tp(`origins.${o}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <p className="type-caption">{t(`needs.${origin}`)}</p>
        <Field label={t("note")}>
          {(fieldId) => (
            <Textarea
              dir="auto"
              disabled={locked}
              id={fieldId}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              value={note}
            />
          )}
        </Field>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-file`}>{t("document")}</Label>
          <Input
            accept="application/pdf,image/jpeg,image/png"
            disabled={locked}
            id={`${id}-file`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            type="file"
          />
          {production.rights_document_path ? (
            <Button
              className="justify-self-start"
              onClick={open}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("openDocument")}
            </Button>
          ) : null}
        </div>
        {locked ? (
          <p className="type-caption">{t("locked")}</p>
        ) : (
          <>
            <p className="type-caption">{t("resetNote")}</p>
            <SaveButton pending={record.isPending} />
          </>
        )}
        <ErrorLine error={record.error} />
      </form>
      {cleared ? null : (
        <div className="grid gap-2">
          <Button
            className="justify-self-start"
            disabled={clear.isPending || recordedByMe}
            onClick={() => clear.mutate()}
          >
            {t("clear")}
          </Button>
          <p className="type-caption">
            {recordedByMe ? t("someoneElse") : t("clearHint")}
          </p>
          <ErrorLine error={clear.error} />
        </div>
      )}
    </div>
  );
};

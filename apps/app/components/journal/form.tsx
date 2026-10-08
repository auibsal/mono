"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { journal, toPlainText } from "@repo/sal-data";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Field, SelectInput } from "../admin/kit";
import { RichTextEditor } from "../editor/rich-text";

export interface WorkValue {
  body_html: string;
  category: journal.Category;
  cover_note: string;
  language: "en" | "ar" | "bilingual";
  rights_note: string;
  source_author: string;
  source_text: string;
  title: string;
}

export const blankWork: WorkValue = {
  body_html: "",
  category: "poetry",
  cover_note: "",
  language: "en",
  rights_note: "",
  source_author: "",
  source_text: "",
  title: "",
};

const LANGUAGES = ["en", "ar", "bilingual"] as const;

/** Columns an author may change while the work is in intake. */
export const revisableColumns = (value: WorkValue) => ({
  body_html: value.body_html || null,
  cover_note: value.cover_note || null,
  rights_note: value.rights_note || null,
  source_author: value.source_author || null,
  source_text: value.source_text || null,
  title: value.title.trim(),
});

/**
 * The work itself. Category and language are fixed once sent (the
 * database only lets authors revise the text and notes).
 */
export const WorkFields = ({
  fixedKind = false,
  onChange,
  value,
}: {
  fixedKind?: boolean;
  onChange: (value: WorkValue) => void;
  value: WorkValue;
}) => {
  const t = useTranslations("nexus.journal.form");
  const tj = useTranslations("nexus.admin.journal");
  const set = <K extends keyof WorkValue>(key: K, v: WorkValue[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-5">
      <Field label={t("title")}>
        {(id) => (
          <Input
            id={id}
            maxLength={300}
            onChange={(e) => set("title", e.target.value)}
            required
            value={value.title}
          />
        )}
      </Field>
      <p className="type-caption">{t("titleHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("category")}>
          {(id) => (
            <SelectInput
              disabled={fixedKind}
              id={id}
              onChange={(e) =>
                set("category", e.target.value as journal.Category)
              }
              value={value.category}
            >
              {journal.categories.map((c) => (
                <option key={c} value={c}>
                  {tj(`categories.${c}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("language")}>
          {(id) => (
            <SelectInput
              disabled={fixedKind}
              id={id}
              onChange={(e) =>
                set("language", e.target.value as WorkValue["language"])
              }
              value={value.language}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {tj(`languages.${l}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>
      <RichTextEditor
        label={t("body")}
        lang={value.language === "ar" ? "ar" : "en"}
        onChange={(html) => set("body_html", html)}
        value={value.body_html}
      />
      <p className="type-caption">{t("bodyHint")}</p>
      {value.category === "translation" ? (
        <fieldset className="grid gap-4">
          <legend className="mb-2 font-medium">{t("translation")}</legend>
          <Field label={t("sourceText")}>
            {(id) => (
              <Textarea
                id={id}
                maxLength={200_000}
                onChange={(e) => set("source_text", e.target.value)}
                required
                rows={6}
                value={value.source_text}
              />
            )}
          </Field>
          <Field label={t("sourceAuthor")}>
            {(id) => (
              <Input
                id={id}
                maxLength={300}
                onChange={(e) => set("source_author", e.target.value)}
                value={value.source_author}
              />
            )}
          </Field>
          <Field hint={t("rightsHint")} label={t("rightsNote")}>
            {(id) => (
              <Textarea
                id={id}
                maxLength={2000}
                onChange={(e) => set("rights_note", e.target.value)}
                required
                rows={3}
                value={value.rights_note}
              />
            )}
          </Field>
        </fieldset>
      ) : null}
      <Field hint={t("coverHint")} label={t("coverNote")}>
        {(id) => (
          <Textarea
            id={id}
            maxLength={2000}
            onChange={(e) => set("cover_note", e.target.value)}
            rows={3}
            value={value.cover_note}
          />
        )}
      </Field>
    </div>
  );
};

/** Reconfirmed with every submission. */
export const AuthorshipPledge = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  const t = useTranslations("nexus.setup.humanAuthorship");
  const id = useId();
  return (
    <fieldset className="grid gap-3 rounded-card bg-surface-tint p-4">
      <legend className="font-medium">{t("title")}</legend>
      <p className="type-body">{t("body")}</p>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          id={id}
          onCheckedChange={(v) => onChange(v === true)}
        />
        <Label className="leading-normal" htmlFor={id}>
          {t("accept")}
        </Label>
      </div>
    </fieldset>
  );
};

/** Text or at least one file; translations need the source and rights note. */
export const workIsReady = (value: WorkValue, fileCount: number) =>
  journal.submissionSchema.safeParse({
    body_html: value.body_html || undefined,
    call_id: "00000000-0000-4000-8000-000000000000",
    category: value.category,
    human_authorship_confirmed: true,
    language: value.language,
    rights_note: value.rights_note || undefined,
    source_text: value.source_text || undefined,
    title: value.title,
  }).success &&
  (Boolean(toPlainText(value.body_html).trim()) || fileCount > 0);

"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { formatNumber } from "@repo/internationalization/format";
import { letters } from "@repo/sal-data";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Field, SelectInput } from "../kit";

const BULLET = "• ";

const Rendered = ({
  filled,
  text,
}: {
  filled: Record<string, string>;
  text: string;
}) => (
  <>
    {letters.fill(text, filled).map((part, index) =>
      part.filled ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed sentence
        <span key={index}>{part.text}</span>
      ) : (
        <mark
          className="rounded-sm bg-surface-tint px-1 text-title"
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed sentence
          key={index}
        >
          {part.text}
        </mark>
      )
    )}
  </>
);

/**
 * The standard letters (L-01 to L-10, and F-05), word for word: fill in
 * each [bracket], then copy the text into an email or print it. Brackets
 * left empty stay marked so nothing goes out half-filled.
 */
export const Letters = () => {
  const t = useTranslations("nexus.admin.forms.letters");
  const tl = useTranslations("nexus.admin.forms.letters.names");
  const id = useId();
  const [key, setKey] = useState<letters.LetterKey>("l05");
  const [values, setValues] = useState<Record<string, Record<string, string>>>(
    {}
  );
  const [copied, setCopied] = useState(false);
  const letter = letters.letters[key];
  const filled = values[key] ?? {};
  const fields = letters.placeholders(letter);
  const missing = fields.filter((f) => !filled[f]?.trim()).length;

  const set = (placeholder: string, value: string) =>
    setValues((v) => ({ ...v, [key]: { ...filled, [placeholder]: value } }));

  const copy = async () => {
    await navigator.clipboard.writeText(letters.letterText(letter, filled));
    setCopied(true);
  };

  return (
    <div className="grid gap-6 pt-4">
      <p className="type-body">{t("lede")}</p>
      <Field label={t("choose")}>
        {(fieldId) => (
          <SelectInput
            className="max-w-md"
            id={fieldId}
            onChange={(e) => {
              setKey(e.target.value as letters.LetterKey);
              setCopied(false);
            }}
            value={key}
          >
            {letters.letterKeys.map((k) => (
              <option key={k} value={k}>
                {letters.letters[k].code} · {tl(k)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <fieldset className="grid content-start gap-3 print:hidden">
          <legend className="mb-2 font-medium text-sm">{t("fill")}</legend>
          {fields.map((placeholder, index) => (
            <div className="grid gap-1" key={placeholder}>
              <label className="text-sm" htmlFor={`${id}-${index}`}>
                {placeholder}
              </label>
              <Input
                dir="auto"
                id={`${id}-${index}`}
                onChange={(e) => set(placeholder, e.target.value)}
                value={filled[placeholder] ?? ""}
              />
            </div>
          ))}
        </fieldset>
        <div className="grid content-start gap-3">
          <dl className="type-caption grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <dt>{t("to")}</dt>
            <dd dir="ltr" lang="en">
              <Rendered filled={filled} text={letter.to} />
            </dd>
            <dt>{t("subject")}</dt>
            <dd dir="ltr" lang="en">
              <Rendered filled={filled} text={letter.subject} />
            </dd>
          </dl>
          <article
            className="grid content-start gap-3 rounded-card bg-surface p-6 text-text"
            data-theme="light"
            dir="ltr"
            lang="en"
          >
            {letter.paragraphs.map((paragraph) =>
              paragraph.startsWith(BULLET) ? (
                <p className="type-body ps-4" key={paragraph}>
                  {BULLET}
                  <Rendered
                    filled={filled}
                    text={paragraph.slice(BULLET.length)}
                  />
                </p>
              ) : (
                <p className="type-body" key={paragraph}>
                  <Rendered filled={filled} text={paragraph} />
                </p>
              )
            )}
          </article>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button onClick={copy} size="sm">
          {t("copy")}
        </Button>
        <Button onClick={() => window.print()} size="sm" variant="outline">
          {t("print")}
        </Button>
        <p className="type-caption" role="status">
          {copied ? t("copied") : ""}
          {missing > 0
            ? ` ${t("missing", { count: missing, countText: formatNumber(missing) })}`
            : ""}
        </p>
      </div>
      <p className="type-caption">{t("englishOnly")}</p>
    </div>
  );
};

"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  formatClock,
  formatIqd,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import type { forms } from "@repo/sal-data";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { DateTimeField, SelectInput } from "../admin/kit";

type Field = forms.FormField;
type Data = forms.FormData;

/** Labels for one form's fields, options, rows and columns. */
export const useFormLabels = (formKey: string) => {
  const t = useTranslations("nexus.forms.defs");
  const at = (path: string) => `${formKey}.${path}` as Parameters<typeof t>[0];
  const get = (path: string) => (t.has(at(path)) ? t(at(path)) : "");
  return {
    column: (field: string, column: string) =>
      get(`columns.${field}.${column}`),
    field: (key: string) => get(`fields.${key}`),
    office: (key: string) => get(`office.${key}`),
    option: (field: string, option: string, office = false) =>
      get(`${office ? "officeOptions" : "options"}.${field}.${option}`) ||
      option,
    preamble: () => get("preamble"),
    purpose: () => get("purpose"),
    row: (field: string, row: string) => get(`rows.${field}.${row}`),
    title: () => get("title"),
  };
};

export type FormLabels = ReturnType<typeof useFormLabels>;

interface InputProps {
  readonly field: Field;
  readonly id: string;
  readonly invalid?: boolean;
  readonly label: string;
  readonly labels: FormLabels;
  readonly office?: boolean;
  readonly onChange: (value: unknown) => void;
  readonly value: unknown;
}

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** One control, without its label (tables and grids label their cells). */
const Control = ({
  field,
  id,
  invalid,
  label,
  labels,
  office = false,
  onChange,
  value,
}: InputProps) => {
  const t = useTranslations("nexus.forms");
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          aria-invalid={invalid}
          dir="auto"
          id={id}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          value={asText(value)}
        />
      );
    case "date":
      return (
        <Input
          aria-invalid={invalid}
          dir="ltr"
          id={id}
          onChange={(e) => onChange(e.target.value)}
          type="date"
          value={asText(value)}
        />
      );
    case "number":
    case "iqd":
      return (
        <Input
          aria-invalid={invalid}
          dir="ltr"
          id={id}
          inputMode="numeric"
          max={field.max}
          min={field.min}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          value={asText(value)}
        />
      );
    case "choice":
      return (
        <SelectInput
          aria-invalid={invalid}
          id={id}
          onChange={(e) => onChange(e.target.value)}
          value={asText(value)}
        >
          <option value="">{t("choose")}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {labels.option(field.key, option, office)}
            </option>
          ))}
        </SelectInput>
      );
    case "check":
      return (
        <Checkbox
          aria-invalid={invalid}
          aria-label={label}
          checked={value === true}
          id={id}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      );
    default:
      return (
        <Input
          aria-invalid={invalid}
          dir={field.type === "url" ? "ltr" : "auto"}
          id={id}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
          type={field.type === "url" ? "url" : "text"}
          value={asText(value)}
        />
      );
  }
};

const MultiInput = ({
  field,
  labels,
  onChange,
  value,
}: {
  field: Field;
  labels: FormLabels;
  onChange: (value: string[]) => void;
  value: unknown;
}) => {
  const id = useId();
  const chosen = Array.isArray(value) ? (value as string[]) : [];
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {(field.options ?? []).map((option) => (
        <li className="flex items-start gap-2" key={option}>
          <Checkbox
            checked={chosen.includes(option)}
            id={`${id}-${option}`}
            onCheckedChange={(checked) =>
              onChange(
                checked === true
                  ? [...chosen, option]
                  : chosen.filter((c) => c !== option)
              )
            }
          />
          <Label className="font-normal" htmlFor={`${id}-${option}`}>
            {labels.option(field.key, option)}
          </Label>
        </li>
      ))}
    </ul>
  );
};

const GridInput = ({
  field,
  labels,
  onChange,
  value,
}: {
  field: Field;
  labels: FormLabels;
  onChange: (value: Data) => void;
  value: unknown;
}) => {
  const locale = useLocale();
  const id = useId();
  const grid = (value ?? {}) as Record<string, Data>;
  const rowLabel = (row: string) =>
    labels.row(field.key, row) || formatIqd(Number(row), locale);
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-accent-line border-b">
            <th className="px-2 py-2" scope="col">
              <span className="sr-only">{labels.field(field.key)}</span>
            </th>
            {(field.columns ?? []).map((col) => (
              <th
                className="type-kicker px-2 py-2 text-start"
                key={col.key}
                scope="col"
              >
                {labels.column(field.key, col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(field.rows ?? []).map((row) => (
            <tr className="border-rule border-b" key={row}>
              <th className="px-2 py-2 text-start font-medium" scope="row">
                {rowLabel(row)}
              </th>
              {(field.columns ?? []).map((col) => (
                <td className="px-2 py-2 align-top" key={col.key}>
                  <Control
                    field={col}
                    id={`${id}-${row}-${col.key}`}
                    label={`${rowLabel(row)}: ${labels.column(field.key, col.key)}`}
                    labels={labels}
                    onChange={(v) =>
                      onChange({
                        ...grid,
                        [row]: { ...(grid[row] ?? {}), [col.key]: v },
                      })
                    }
                    value={grid[row]?.[col.key]}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableInput = ({
  field,
  labels,
  onChange,
  value,
}: {
  field: Field;
  labels: FormLabels;
  onChange: (value: Data[]) => void;
  value: unknown;
}) => {
  const t = useTranslations("nexus.forms");
  const id = useId();
  const rows = Array.isArray(value) ? (value as Data[]) : [];
  const set = (index: number, key: string, v: unknown) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: v } : r)));
  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <fieldset
          className="grid gap-3 rounded-card bg-surface-tint p-4 sm:grid-cols-2"
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids; their order is the identity
          key={index}
        >
          <legend className="sr-only">
            {t("row", { number: formatNumber(index + 1) })}
          </legend>
          {(field.columns ?? []).map((col) => {
            const cellId = `${id}-${index}-${col.key}`;
            return (
              <div className="grid gap-1" key={col.key}>
                <Label htmlFor={cellId}>
                  {labels.column(field.key, col.key)}
                </Label>
                <Control
                  field={col}
                  id={cellId}
                  label={labels.column(field.key, col.key)}
                  labels={labels}
                  onChange={(v) => set(index, col.key, v)}
                  value={row[col.key]}
                />
              </div>
            );
          })}
          <Button
            className="justify-self-start"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("removeRow")}
          </Button>
        </fieldset>
      ))}
      {field.max === undefined || rows.length < field.max ? (
        <Button
          className="justify-self-start"
          onClick={() => onChange([...rows, {}])}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("addRow")}
        </Button>
      ) : null}
    </div>
  );
};

interface FieldProps {
  readonly field: Field;
  readonly invalid?: boolean;
  readonly labels: FormLabels;
  readonly office?: boolean;
  readonly onChange: (value: unknown) => void;
  readonly value: unknown;
}

/** A labeled field of any type. */
export const FormFieldInput = ({
  field,
  invalid = false,
  labels,
  office = false,
  onChange,
  value,
}: FieldProps) => {
  const t = useTranslations("nexus.forms");
  const id = useId();
  const label = office ? labels.office(field.key) : labels.field(field.key);
  const required = field.required ? (
    <span className="text-title"> {t("required")}</span>
  ) : null;

  if (field.type === "datetime") {
    return (
      <DateTimeField
        label={label}
        onChange={(iso) => onChange(iso)}
        required={field.required}
        value={typeof value === "string" ? value : null}
      />
    );
  }
  if (field.type === "check") {
    return (
      <div className="flex items-start gap-2">
        <Control
          field={field}
          id={id}
          invalid={invalid}
          label={label}
          labels={labels}
          office={office}
          onChange={onChange}
          value={value}
        />
        <Label className="font-normal" htmlFor={id}>
          {label}
          {required}
        </Label>
      </div>
    );
  }
  if (
    field.type === "multi" ||
    field.type === "grid" ||
    field.type === "table"
  ) {
    let control: React.ReactNode;
    if (field.type === "multi") {
      control = (
        <MultiInput
          field={field}
          labels={labels}
          onChange={onChange}
          value={value}
        />
      );
    } else if (field.type === "grid") {
      control = (
        <GridInput
          field={field}
          labels={labels}
          onChange={onChange}
          value={value}
        />
      );
    } else {
      control = (
        <TableInput
          field={field}
          labels={labels}
          onChange={onChange}
          value={value}
        />
      );
    }
    return (
      <fieldset aria-invalid={invalid} className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">
          {label}
          {required}
        </legend>
        {control}
      </fieldset>
    );
  }
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required}
      </Label>
      <Control
        field={field}
        id={id}
        invalid={invalid}
        label={label}
        labels={labels}
        office={office}
        onChange={onChange}
        value={value}
      />
    </div>
  );
};

// ── Read-only ───────────────────────────────────────────────────────────────

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const ValueText = ({
  field,
  labels,
  office,
  value,
}: {
  field: Field;
  labels: FormLabels;
  office?: boolean;
  value: unknown;
}) => {
  const t = useTranslations("nexus.forms");
  const locale = useLocale();
  if (field.type === "check") {
    return <>{value === true ? t("yes") : t("no")}</>;
  }
  if (isEmpty(value)) {
    return <span className="text-text-meta">{t("blank")}</span>;
  }
  switch (field.type) {
    case "choice":
      return <>{labels.option(field.key, String(value), office)}</>;
    case "multi":
      return (
        <>
          {(value as string[])
            .map((v) => labels.option(field.key, v))
            .join(" · ")}
        </>
      );
    case "date":
      return <>{formatLongDate(String(value), locale, true)}</>;
    case "datetime":
      return (
        <>
          {formatLongDate(String(value), locale, true)} ·{" "}
          {formatClock(String(value), locale)}
        </>
      );
    case "iqd":
      return <>{formatIqd(Number(value), locale)}</>;
    case "number":
      return <>{formatNumber(Number(value))}</>;
    default:
      return (
        <span className="whitespace-pre-wrap" dir="auto">
          {String(value)}
        </span>
      );
  }
};

const TableView = ({
  field,
  labels,
  value,
}: {
  field: Field;
  labels: FormLabels;
  value: unknown;
}) => {
  const locale = useLocale();
  const grid = field.type === "grid";
  const rows: [string, Data][] = grid
    ? (field.rows ?? []).map((row) => [
        labels.row(field.key, row) || formatIqd(Number(row), locale),
        ((value ?? {}) as Record<string, Data>)[row] ?? {},
      ])
    : (Array.isArray(value) ? (value as Data[]) : []).map((row, i) => [
        formatNumber(i + 1),
        row,
      ]);
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-accent-line border-b">
            <th className="px-2 py-1" scope="col">
              <span className="sr-only">{labels.field(field.key)}</span>
            </th>
            {(field.columns ?? []).map((col) => (
              <th
                className="type-kicker px-2 py-1 text-start"
                key={col.key}
                scope="col"
              >
                {labels.column(field.key, col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, row]) => (
            <tr className="border-rule border-b" key={label}>
              <th className="px-2 py-1 text-start font-medium" scope="row">
                {label}
              </th>
              {(field.columns ?? []).map((col) => (
                <td className="px-2 py-1 align-top" key={col.key}>
                  <ValueText field={col} labels={labels} value={row[col.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** A filled form, laid out like the printed one. */
export const FormValues = ({
  data,
  fields,
  labels,
  office = false,
}: {
  data: Data;
  fields: readonly Field[];
  labels: FormLabels;
  office?: boolean;
}) => (
  <dl className="grid gap-4">
    {fields.map((field) => (
      <div className="grid gap-1 border-rule border-b pb-3" key={field.key}>
        <dt className="type-kicker">
          {office ? labels.office(field.key) : labels.field(field.key)}
        </dt>
        <dd className="type-body">
          {field.type === "grid" || field.type === "table" ? (
            <TableView field={field} labels={labels} value={data[field.key]} />
          ) : (
            <ValueText
              field={field}
              labels={labels}
              office={office}
              value={data[field.key]}
            />
          )}
        </dd>
      </div>
    ))}
  </dl>
);

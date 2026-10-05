"use client";

import { useAuth } from "@repo/auth/provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import {
  formatNumber,
  fromZonedInputValue,
  toZonedInputValue,
} from "@repo/internationalization/format";
import { DataError } from "@repo/sal-data";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { callApiText } from "@/lib/api";

// ── Page heading ────────────────────────────────────────────────────────────

interface AdminHeadingProps {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly title: string;
}

/** The top of an admin page: title, optional lede and actions at the end. */
export const AdminHeading = ({
  actions,
  children,
  title,
}: AdminHeadingProps) => (
  <header className="grid gap-2 border-accent-line border-b-2 pb-gap-tight">
    <div className="flex flex-wrap items-end justify-between gap-gap">
      <h1 className="font-bold text-2xl text-text leading-tight">{title}</h1>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
    {children ? (
      <div className="type-body text-text-secondary">{children}</div>
    ) : null}
  </header>
);

// ── Tables ──────────────────────────────────────────────────────────────────

export interface Column<T> {
  readonly cell: (row: T) => ReactNode;
  readonly className?: string;
  readonly header: string;
  readonly key: string;
}

interface DataTableProps<T> {
  readonly caption?: string;
  readonly columns: readonly Column<T>[];
  readonly empty?: string;
  readonly rowKey: (row: T) => string;
  readonly rows: readonly T[];
}

/**
 * Brand tables: a crimson hairline under the head and grey hairlines
 * between rows, never full grids. Scrolls sideways on small screens.
 */
export const DataTable = <T,>({
  caption,
  columns,
  empty,
  rowKey,
  rows,
}: DataTableProps<T>) => {
  const t = useTranslations("nexus.admin.kit");

  if (rows.length === 0) {
    return (
      <p className="type-body py-6 text-text-secondary">
        {empty ?? t("empty")}
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-accent-line border-b">
            {columns.map((column) => (
              <th
                className={cn(
                  "type-kicker whitespace-nowrap px-2 py-2 text-start align-bottom",
                  column.className
                )}
                key={column.key}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-rule border-b" key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  className={cn("px-2 py-2 align-top", column.className)}
                  key={column.key}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const RowCount = ({ count }: { count: number }) => {
  const t = useTranslations("nexus.admin.kit");
  return (
    <p className="type-caption" role="status">
      {t("rows", { count, countText: formatNumber(count) })}
    </p>
  );
};

// ── Fields ──────────────────────────────────────────────────────────────────

interface FieldProps {
  readonly children: (id: string) => ReactNode;
  readonly className?: string;
  readonly hint?: string;
  readonly label: string;
}

/** A labelled field; the render prop receives the control's id. */
export const Field = ({ children, className, hint, label }: FieldProps) => {
  const id = useId();
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint ? <p className="type-caption">{hint}</p> : null}
    </div>
  );
};

interface BilingualProps {
  readonly label: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly onChange: (value: { ar: string; en: string }) => void;
  readonly required?: boolean;
  readonly rows?: number;
  readonly value: { ar: string; en: string };
}

/**
 * A paired `_en` / `_ar` field: English left-to-right, Arabic right-to-left
 * with `lang="ar"`, side by side on wide screens.
 */
export const BilingualField = ({
  label,
  maxLength,
  multiline = false,
  onChange,
  required = false,
  rows = 4,
  value,
}: BilingualProps) => {
  const t = useTranslations("nexus.admin.kit");
  const Control = multiline ? Textarea : Input;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 font-medium text-sm">{label}</legend>
      <Field label={t("english")}>
        {(id) => (
          <Control
            dir="ltr"
            id={id}
            lang="en"
            maxLength={maxLength}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            required={required}
            rows={multiline ? rows : undefined}
            value={value.en}
          />
        )}
      </Field>
      <Field label={t("arabic")}>
        {(id) => (
          <Control
            dir="rtl"
            id={id}
            lang="ar"
            maxLength={maxLength}
            onChange={(e) => onChange({ ...value, ar: e.target.value })}
            required={required}
            rows={multiline ? rows : undefined}
            value={value.ar}
          />
        )}
      </Field>
    </fieldset>
  );
};

interface DateTimeFieldProps {
  readonly label: string;
  readonly onChange: (iso: string | null) => void;
  readonly required?: boolean;
  /** An ISO instant (UTC), or null. */
  readonly value: string | null;
}

/** Shown and entered as Baghdad wall-clock time; stored as UTC. */
export const DateTimeField = ({
  label,
  onChange,
  required = false,
  value,
}: DateTimeFieldProps) => {
  const t = useTranslations("nexus.admin.kit");
  return (
    <Field hint={t("baghdadTime")} label={label}>
      {(id) => (
        <Input
          dir="ltr"
          id={id}
          onChange={(e) => onChange(fromZonedInputValue(e.target.value))}
          required={required}
          type="datetime-local"
          value={toZonedInputValue(value)}
        />
      )}
    </Field>
  );
};

/** A native select, styled like the inputs (works with keyboards and RTL). */
export const SelectInput = ({
  className,
  ...props
}: React.ComponentProps<"select">) => (
  <select
    className={cn(
      "h-9 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:outline-2",
      className
    )}
    {...props}
  />
);

// ── Actions ─────────────────────────────────────────────────────────────────

/** Maps a Postgres or API error to a plain reason for the person. */
export const useErrorReason = () => {
  const t = useTranslations("nexus.admin.kit");
  return (error: unknown) => {
    const code = error instanceof DataError ? error.code : "";
    let reason = t("reasons.unknown");
    if (code === "42501") {
      reason = t("reasons.forbidden");
    } else if (code === "23505") {
      reason = t("reasons.conflict");
    } else if (code.startsWith("22") || code.startsWith("23")) {
      reason = t("reasons.invalid");
    }
    return t("actionFailed", { reason });
  };
};

export const ErrorLine = ({ error }: { error: unknown }) => {
  const reason = useErrorReason();
  return error ? (
    <p className="text-sm text-title" role="alert">
      {reason(error)}
    </p>
  ) : null;
};

interface ConfirmActionProps {
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly variant?: "default" | "outline" | "ghost";
}

/** Every destructive or money action asks first (brief §8). */
export const ConfirmAction = ({
  children,
  confirmLabel,
  description,
  disabled = false,
  onConfirm,
  variant = "outline",
}: ConfirmActionProps) => {
  const t = useTranslations();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm" variant={variant}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("nexus.admin.kit.confirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface SaveButtonProps {
  readonly disabled?: boolean;
  readonly pending: boolean;
  readonly success?: boolean;
}

export const SaveButton = ({
  disabled = false,
  pending,
  success = false,
}: SaveButtonProps) => {
  const t = useTranslations("common");
  let label = t("save");
  if (pending) {
    label = t("saving");
  } else if (success) {
    label = t("saved");
  }
  return (
    <Button
      className="justify-self-start"
      disabled={disabled || pending}
      type="submit"
    >
      {label}
    </Button>
  );
};

interface ExportButtonProps {
  readonly fileName: string;
  /** apps/api export name (apps/api/lib/exports.ts). */
  readonly name: string;
  readonly params?: Record<string, string>;
}

/** Downloads a CSV from apps/api, which re-checks the permission. */
export const ExportButton = ({
  fileName,
  name,
  params = {},
}: ExportButtonProps) => {
  const t = useTranslations("nexus.admin.kit");
  const { supabase } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  const run = async () => {
    setState("busy");
    try {
      const csv = await callApiText(supabase, `/exports/${name}`, params);
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="grid gap-1">
      <Button
        disabled={state === "busy"}
        onClick={run}
        size="sm"
        variant="outline"
      >
        {state === "busy" ? t("exporting") : t("export")}
      </Button>
      {state === "failed" ? (
        <p className="text-title text-xs" role="alert">
          {t("exportFailed")}
        </p>
      ) : null}
    </div>
  );
};

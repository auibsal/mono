"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { getMediaUrl, uploadMedia } from "@repo/storage";
import { StorageError } from "@repo/storage/files";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

interface ImageFieldProps {
  /** Folder in the public media bucket, e.g. "events". */
  readonly area: string;
  /** "pdf" takes a PDF (issue PDFs) and shows a link instead of a preview. */
  readonly kind?: "image" | "pdf";
  readonly label?: string;
  readonly onChange: (path: string | null) => void;
  /** Object path in the media bucket, or null. */
  readonly value: string | null;
}

/**
 * Uploads a published image to the public media bucket (the bucket policy
 * decides who may) and keeps its path. Our own consented photos only.
 */
export const ImageField = ({
  area,
  kind = "image",
  label,
  onChange,
  value,
}: ImageFieldProps) => {
  const t = useTranslations("nexus.admin.kit");
  const { supabase } = useAuth();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reasonFor = (error: unknown) => {
    const code = error instanceof StorageError ? error.code : "";
    if (code === "too_large") {
      return t("fileReasons.too_large");
    }
    if (code === "type_not_allowed") {
      return t("fileReasons.wrong_type");
    }
    return t("fileReasons.other");
  };

  const upload = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const stored = await uploadMedia(supabase, area, file);
      onChange(stored.path);
    } catch (error) {
      setProblem(t("uploadFailed", { reason: reasonFor(error) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label ?? t("image")}</Label>
      {value ? (
        <div className="flex flex-wrap items-end gap-3">
          {kind === "pdf" ? (
            <a
              className="break-all text-sm underline underline-offset-4"
              dir="ltr"
              href={getMediaUrl(supabase, value)}
              rel="noopener"
              target="_blank"
            >
              {value.slice(value.lastIndexOf("/") + 1)}
            </a>
          ) : (
            // biome-ignore lint/performance/noImgElement: a preview of a just-uploaded object
            <img
              alt={t("imageAlt")}
              className="h-32 w-auto rounded-card"
              height={128}
              src={getMediaUrl(supabase, value)}
              width={192}
            />
          )}
          <Button
            onClick={() => onChange(null)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("removeImage")}
          </Button>
        </div>
      ) : null}
      <Input
        accept={
          kind === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp"
        }
        disabled={busy}
        id={id}
        onChange={(e) => upload(e.target.files?.[0])}
        type="file"
      />
      <p className="type-caption">
        {busy ? t("uploading") : null}
        {!busy && kind === "image" ? t("noImageNote") : null}
      </p>
      {problem ? (
        <p className="text-sm text-title" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
};

"use client";

import type { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { formatNumber } from "@repo/internationalization/format";
import { journal, unwrap } from "@repo/sal-data";
import { removeFiles, uploadSubmissionFile } from "@repo/storage";
import { useTranslations } from "next-intl";
import { useId } from "react";

export type FileKind = "manuscript" | "image" | "source";

export interface PendingFile {
  file: File;
  kind: FileKind;
}

export const acceptFor = (kind: FileKind) =>
  kind === "image"
    ? journal.submissionFileTypes.image.join(",")
    : journal.submissionFileTypes.manuscript.join(",");

/** Which files a category asks for (translations add the source text). */
export const kindsFor = (category: journal.Category): FileKind[] => {
  if (category === "art_photography") {
    return ["image"];
  }
  if (category === "translation") {
    return ["manuscript", "source"];
  }
  return ["manuscript"];
};

/** Uploads into the private bucket, then records the file. */
export const attachFile = async (
  supabase: ReturnType<typeof useAuth>["supabase"],
  submissionId: string,
  { file, kind }: PendingFile
) => {
  const stored = await uploadSubmissionFile(supabase, submissionId, file);
  try {
    unwrap(
      await supabase.schema("journal").from("submission_files").insert({
        kind,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: stored.path,
        submission_id: submissionId,
      })
    );
  } catch (error) {
    await removeFiles(supabase, "submissions", [stored.path]);
    throw error;
  }
};

export const detachFile = async (
  supabase: ReturnType<typeof useAuth>["supabase"],
  file: { id: string; storage_path: string }
) => {
  unwrap(
    await supabase
      .schema("journal")
      .from("submission_files")
      .delete()
      .eq("id", file.id)
  );
  await removeFiles(supabase, "submissions", [file.storage_path]);
};

/** One file input per kind the category needs. */
export const FilePicker = ({
  disabled = false,
  kinds,
  onAdd,
}: {
  disabled?: boolean;
  kinds: FileKind[];
  onAdd: (files: PendingFile[]) => void;
}) => {
  const t = useTranslations("nexus.waraq.files");
  const id = useId();
  return (
    <div className="grid gap-3">
      {kinds.map((kind) => (
        <div className="grid gap-1" key={kind}>
          <label className="font-medium text-sm" htmlFor={`${id}-${kind}`}>
            {t(`kinds.${kind}`)}
          </label>
          <Input
            accept={acceptFor(kind)}
            disabled={disabled}
            id={`${id}-${kind}`}
            multiple={kind === "image"}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])].map((file) => ({
                file,
                kind,
              }));
              onAdd(files);
              e.target.value = "";
            }}
            type="file"
          />
          <p className="type-caption">
            {t(`hints.${kind}`, {
              size: formatNumber(journal.MAX_FILE_BYTES / 1024 / 1024),
            })}
          </p>
        </div>
      ))}
    </div>
  );
};

export const PendingList = ({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (index: number) => void;
}) => {
  const t = useTranslations("nexus.waraq.files");
  return files.length ? (
    <ul className="grid gap-1">
      {files.map((f, index) => (
        <li
          className="flex flex-wrap items-center gap-3"
          key={`${f.kind}-${f.file.name}-${f.file.size}`}
        >
          <span className="text-sm">
            {t(`kinds.${f.kind}`)}: {f.file.name}
          </span>
          <Button
            onClick={() => onRemove(index)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("remove")}
          </Button>
        </li>
      ))}
    </ul>
  ) : null;
};

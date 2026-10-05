"use client";

import type { RoomKind } from "@repo/collaboration/rooms";
import { useTranslations } from "next-intl";
import { Collaboration } from "../../editor/collaboration";
import {
  CollaborativeRichTextEditor,
  RichTextEditor,
} from "../../editor/rich-text";

interface BilingualRichTextProps {
  /** Record id once saved; co-editing opens only for saved records. */
  readonly id: string | null;
  readonly kind: RoomKind;
  /** Receives only the language that changed (two editors may type at once). */
  readonly onChange: (patch: { ar?: string; en?: string }) => void;
  readonly value: { ar: string; en: string };
}

/**
 * English and Arabic rich text for one record, co-edited live when
 * collaboration is on (one Liveblocks room per record, a field per language).
 */
export const BilingualRichText = ({
  id,
  kind,
  onChange,
  value,
}: BilingualRichTextProps) => {
  const t = useTranslations("nexus.admin.content");

  const solo = (
    <div className="grid gap-4">
      <RichTextEditor
        label={t("bodyEn")}
        lang="en"
        onChange={(en) => onChange({ en })}
        value={value.en}
      />
      <RichTextEditor
        label={t("bodyAr")}
        lang="ar"
        onChange={(ar) => onChange({ ar })}
        value={value.ar}
      />
    </div>
  );

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 font-medium text-sm">{t("body")}</legend>
      {id ? (
        <Collaboration id={id} kind={kind} solo={solo}>
          <div className="grid gap-4">
            <CollaborativeRichTextEditor
              field="body_en"
              label={t("bodyEn")}
              lang="en"
              onChange={(en) => onChange({ en })}
              value={value.en}
            />
            <CollaborativeRichTextEditor
              field="body_ar"
              label={t("bodyAr")}
              lang="ar"
              onChange={(ar) => onChange({ ar })}
              value={value.ar}
            />
          </div>
        </Collaboration>
      ) : (
        solo
      )}
    </fieldset>
  );
};

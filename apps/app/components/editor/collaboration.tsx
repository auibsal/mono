"use client";

import { useAuth } from "@repo/auth/provider";
import { presenceColor } from "@repo/collaboration/colors";
import { Room, useOthers } from "@repo/collaboration/room";
import { type RoomKind, roomId } from "@repo/collaboration/rooms";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { useProfile } from "@/lib/queries";
import { SectionSpinner } from "../states";

/** Who else is in the room, in words. */
const Presence = () => {
  const t = useTranslations("nexus.editor");
  const others = useOthers();
  const names = [...new Set(others.map((o) => o.name).filter(Boolean))];
  return (
    <p className="type-caption" role="status">
      {names.length > 0
        ? t("alsoEditing", { names: names.join("، ") })
        : t("liveNote")}
    </p>
  );
};

interface CollaborationProps {
  /** Rendered inside the room. */
  readonly children: ReactNode;
  readonly id: string;
  readonly kind: RoomKind;
  /** Rendered until the person is known (co-editing needs a name). */
  readonly solo: ReactNode;
}

/**
 * Opens the record's co-editing room (Supabase Realtime, packages/
 * collaboration). The database lets in only people who may edit the
 * record; anyone else's channel is refused and they keep the solo editor.
 */
export const Collaboration = ({
  children,
  id,
  kind,
  solo,
}: CollaborationProps) => {
  const t = useTranslations("nexus.editor");
  const { supabase, user } = useAuth();
  const profile = useProfile();
  const name = profile.data?.full_name_en;

  const self = useMemo(
    () =>
      user && name
        ? { color: presenceColor(user.id), id: user.id, name }
        : null,
    [user, name]
  );

  if (!self) {
    return solo;
  }

  return (
    <Room
      fallback={
        <div className="grid gap-2">
          <p className="type-caption">{t("connecting")}</p>
          <SectionSpinner />
        </div>
      }
      id={roomId(kind, id)}
      self={self}
      supabase={supabase}
    >
      <Presence />
      {children}
    </Room>
  );
};

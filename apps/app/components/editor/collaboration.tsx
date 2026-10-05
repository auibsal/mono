"use client";

import { useOthers } from "@liveblocks/react/suspense";
import { useAuth } from "@repo/auth/provider";
import { Room } from "@repo/collaboration/room";
import { type RoomKind, roomId } from "@repo/collaboration/rooms";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { env } from "@/env";
import { callApi } from "@/lib/api";
import { SectionSpinner } from "../states";

export const collaborationEnabled = () =>
  env.NEXT_PUBLIC_LIVEBLOCKS_ENABLED === "true";

/** Who else is in the room, in words. */
const Presence = () => {
  const t = useTranslations("nexus.editor");
  const others = useOthers();
  const names = [...new Set(others.map((o) => o.info?.name).filter(Boolean))];
  return (
    <p className="type-caption" role="status">
      {names.length > 0
        ? t("alsoEditing", { names: names.join("، ") })
        : t("liveNote")}
    </p>
  );
};

interface CollaborationProps {
  /** Rendered when co-editing is on (inside the room). */
  readonly children: ReactNode;
  readonly id: string;
  readonly kind: RoomKind;
  /** Rendered when co-editing is off (no Liveblocks key). */
  readonly solo: ReactNode;
}

/**
 * Opens the record's collaboration room when co-editing is enabled; apps/api
 * checks the member may edit the record before issuing a token.
 */
export const Collaboration = ({
  children,
  id,
  kind,
  solo,
}: CollaborationProps) => {
  const t = useTranslations("nexus.editor");
  const { supabase } = useAuth();

  if (!collaborationEnabled()) {
    return solo;
  }

  return (
    <Room
      authEndpoint={(room) =>
        callApi(supabase, "/collaboration/auth", {
          room: room ?? roomId(kind, id),
        })
      }
      fallback={
        <div className="grid gap-2">
          <p className="type-caption">{t("connecting")}</p>
          <SectionSpinner />
        </div>
      }
      id={roomId(kind, id)}
    >
      <Presence />
      {children}
    </Room>
  );
};

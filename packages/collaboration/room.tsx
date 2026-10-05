"use client";

import type { ClientOptions } from "@liveblocks/client";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import type { ReactNode } from "react";

/** A callback that fetches a token for the room from apps/api. */
type AuthEndpoint = NonNullable<ClientOptions["authEndpoint"]>;

interface RoomProps {
  authEndpoint: AuthEndpoint;
  children: ReactNode;
  fallback: ReactNode;
  id: string;
}

export const Room = ({ authEndpoint, children, fallback, id }: RoomProps) => (
  <LiveblocksProvider authEndpoint={authEndpoint} throttle={100}>
    <RoomProvider id={id} initialPresence={{ field: null }}>
      <ClientSideSuspense fallback={fallback}>{children}</ClientSideSuspense>
    </RoomProvider>
  </LiveblocksProvider>
);

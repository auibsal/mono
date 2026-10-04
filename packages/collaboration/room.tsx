"use client";

import type {
  ClientOptions,
  ResolveMentionSuggestionsArgs,
} from "@liveblocks/client";
import type { ResolveUsersArgs } from "@liveblocks/node";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import type { ReactNode } from "react";

/** A URL, or a callback that fetches a token (e.g. from apps/api). */
type AuthEndpoint = NonNullable<ClientOptions["authEndpoint"]>;

interface RoomProps {
  authEndpoint: AuthEndpoint;
  children: ReactNode;
  fallback: ReactNode;
  id: string;
  resolveMentionSuggestions?: (
    args: ResolveMentionSuggestionsArgs
  ) => Promise<string[]>;
  resolveUsers?: (
    args: ResolveUsersArgs
  ) => Promise<(Liveblocks["UserMeta"]["info"] | undefined)[]>;
}

export const Room = ({
  authEndpoint,
  children,
  fallback,
  id,
  resolveMentionSuggestions,
  resolveUsers,
}: RoomProps) => (
  <LiveblocksProvider
    authEndpoint={authEndpoint}
    resolveMentionSuggestions={resolveMentionSuggestions}
    resolveUsers={resolveUsers}
  >
    <RoomProvider id={id} initialPresence={{ cursor: null }}>
      <ClientSideSuspense fallback={fallback}>{children}</ClientSideSuspense>
    </RoomProvider>
  </LiveblocksProvider>
);

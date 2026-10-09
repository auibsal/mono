"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { type Peer, RealtimeYjsProvider } from "./provider";

const RoomContext = createContext<RealtimeYjsProvider | null>(null);

interface RoomProps {
  children: ReactNode;
  /** Shown until the draft is current. */
  fallback: ReactNode;
  id: string;
  self: Peer;
  supabase: SupabaseClient;
}

/** Opens the record's co-editing room for its children. */
export const Room = ({ children, fallback, id, self, supabase }: RoomProps) => {
  const [provider, setProvider] = useState<RealtimeYjsProvider | null>(null);

  useEffect(() => {
    const next = new RealtimeYjsProvider(supabase, id, self);
    setProvider(next);
    return () => next.destroy();
    // `self` is memoized by the caller: a new room only when it changes.
  }, [supabase, id, self]);

  const synced = useSyncExternalStore(
    (listener) => provider?.subscribe(listener) ?? (() => undefined),
    () => provider?.synced ?? false,
    () => false
  );

  if (!(provider && synced)) {
    return fallback;
  }
  return (
    <RoomContext.Provider value={provider}>{children}</RoomContext.Provider>
  );
};

/** The room's provider (inside a Room). */
export const useRoom = () => {
  const provider = useContext(RoomContext);
  if (!provider) {
    throw new Error("useRoom must be used inside <Room>");
  }
  return provider;
};

/** Everyone else in the room. */
export const useOthers = () => {
  const provider = useRoom();
  return useSyncExternalStore(
    (listener) => provider.subscribe(listener),
    () => provider.peers,
    () => provider.peers
  );
};

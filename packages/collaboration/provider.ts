import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  applyUpdate,
  Doc,
  encodeStateAsUpdate,
  encodeStateVector,
  mergeUpdates,
} from "yjs";

/**
 * Live co-editing over Supabase Realtime: free, under our own sign-in, no
 * vendor badge. A room is a private Realtime channel named after the record
 * (`sal:<kind>:<uuid>`); the database lets only people who may edit that
 * record join it (migration 20261008001600). The shared draft is a Yjs
 * document; edits travel as broadcast messages and names as presence.
 * Nothing is stored in the channel: Save still writes the record.
 *
 * Joining: the newcomer asks for the others' state ("sync-request") and
 * merges every reply. When nobody answers within SYNC_WAIT_MS, it is alone
 * and seeds the draft from the saved record (see `alone`).
 */

export interface Peer {
  color: string;
  id: string;
  name: string;
}

type Listener = () => void;

const SYNC_WAIT_MS = 1200;
/** Merge keystrokes into one message at most this often. */
const FLUSH_MS = 80;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export class RealtimeYjsProvider {
  readonly doc = new Doc();
  private ready = false;
  /** True when nobody else was in the room when we joined. */
  alone = false;
  peers: Peer[] = [];

  private readonly channel: RealtimeChannel;
  private readonly listeners = new Set<Listener>();
  private pending: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly self: Peer;

  /** True once the draft is current: synced with others, or alone. */
  get synced() {
    return this.ready;
  }

  constructor(supabase: SupabaseClient, topic: string, self: Peer) {
    this.self = self;
    this.channel = supabase.channel(topic, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: `${self.id}:${crypto.randomUUID()}` },
        private: true,
      },
    });

    this.doc.on("update", this.onLocalUpdate);

    this.channel
      .on("broadcast", { event: "update" }, ({ payload }) => {
        applyUpdate(this.doc, fromBase64(String(payload.u)), this);
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        const stateVector = fromBase64(String(payload.sv));
        this.send("sync-reply", {
          u: toBase64(encodeStateAsUpdate(this.doc, stateVector)),
        });
      })
      .on("broadcast", { event: "sync-reply" }, ({ payload }) => {
        applyUpdate(this.doc, fromBase64(String(payload.u)), this);
        this.markSynced(false);
      })
      .on("presence", { event: "sync" }, () => {
        const state = this.channel.presenceState<Peer>();
        const seen = new Map<string, Peer>();
        for (const entries of Object.values(state)) {
          for (const peer of entries) {
            if (peer.id !== this.self.id) {
              seen.set(peer.id, {
                color: peer.color,
                id: peer.id,
                name: peer.name,
              });
            }
          }
        }
        this.peers = [...seen.values()];
        this.emit();
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          return;
        }
        this.channel.track(this.self);
        this.send("sync-request", {
          sv: toBase64(encodeStateVector(this.doc)),
        });
        this.syncTimer = setTimeout(() => this.markSynced(true), SYNC_WAIT_MS);
      });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy() {
    this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.doc.off("update", this.onLocalUpdate);
    this.channel.unsubscribe();
    this.doc.destroy();
    this.listeners.clear();
  }

  private readonly onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) {
      return;
    }
    this.pending.push(update);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
    }
  };

  private flush() {
    this.flushTimer = null;
    if (this.pending.length === 0) {
      return;
    }
    const merged = mergeUpdates(this.pending);
    this.pending = [];
    this.send("update", { u: toBase64(merged) });
  }

  private send(event: string, payload: Record<string, string>) {
    this.channel.send({ event, payload, type: "broadcast" });
  }

  private markSynced(alone: boolean) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: an earlier reply or the timer may have set it
    if (this.ready) {
      return;
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.ready = true;
    this.alone = alone;
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

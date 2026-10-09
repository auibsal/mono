import { afterEach, describe, expect, test, vi } from "vitest";
import { RealtimeYjsProvider } from "./provider";

type Handler = (message: { payload: Record<string, unknown> }) => void;

/** An in-memory stand-in for Supabase Realtime: one bus per topic. */
const fakeRealtime = () => {
  const channels: FakeChannel[] = [];
  class FakeChannel {
    private readonly handlers = new Map<string, Handler[]>();
    presence: Record<string, unknown[]> = {};
    private presenceSync: (() => void) | null = null;
    readonly config: { private: boolean };
    readonly topic: string;
    tracked: unknown = null;

    constructor(topic: string, options: { config: { private: boolean } }) {
      this.topic = topic;
      this.config = options.config;
      channels.push(this);
    }

    on(
      type: string,
      filter: { event: string },
      handler: Handler | (() => void)
    ) {
      if (type === "presence") {
        this.presenceSync = handler as () => void;
      } else {
        const list = this.handlers.get(filter.event) ?? [];
        list.push(handler as Handler);
        this.handlers.set(filter.event, list);
      }
      return this;
    }

    subscribe(callback: (status: string) => void) {
      queueMicrotask(() => callback("SUBSCRIBED"));
      return this;
    }

    send({
      event,
      payload,
    }: {
      event: string;
      payload: Record<string, unknown>;
    }) {
      for (const other of channels) {
        if (other !== this && other.topic === this.topic) {
          for (const handler of other.handlers.get(event) ?? []) {
            handler({ payload });
          }
        }
      }
    }

    track(state: unknown) {
      this.tracked = state;
      const everyone: Record<string, unknown[]> = {};
      channels
        .filter((c) => c.topic === this.topic && c.tracked)
        .forEach((c, i) => {
          everyone[String(i)] = [c.tracked];
        });
      for (const c of channels.filter((x) => x.topic === this.topic)) {
        c.presence = everyone;
        c.presenceSync?.();
      }
    }

    presenceState() {
      return this.presence;
    }

    unsubscribe() {
      channels.splice(channels.indexOf(this), 1);
    }
  }
  return {
    channels,
    client: {
      channel: (topic: string, options: { config: { private: boolean } }) =>
        new FakeChannel(topic, options),
    } as never,
  };
};

const ROOM = "sal:news:00000000-0000-0000-0000-00000000b001";
const ada = { color: "var(--sal-ink)", id: "u1", name: "Ada" };
const bo = { color: "var(--sal-crimson)", id: "u2", name: "Bo" };

const settle = async () => {
  await vi.advanceTimersByTimeAsync(2000);
};

describe("co-editing over Realtime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("joins a private channel; alone, it says so", async () => {
    vi.useFakeTimers();
    const realtime = fakeRealtime();
    const first = new RealtimeYjsProvider(realtime.client, ROOM, ada);
    await settle();
    expect(realtime.channels[0]?.config.private).toBe(true);
    expect(first.synced).toBe(true);
    expect(first.alone).toBe(true);
    first.destroy();
  });

  test("a newcomer receives the draft, and edits flow both ways", async () => {
    vi.useFakeTimers();
    const realtime = fakeRealtime();
    const first = new RealtimeYjsProvider(realtime.client, ROOM, ada);
    await settle();
    first.doc.getText("body_en").insert(0, "Hello");
    await settle();

    const second = new RealtimeYjsProvider(realtime.client, ROOM, bo);
    await settle();
    expect(second.alone).toBe(false);
    expect(second.doc.getText("body_en").toString()).toBe("Hello");
    expect(first.peers.map((p) => p.name)).toEqual(["Bo"]);
    expect(second.peers.map((p) => p.name)).toEqual(["Ada"]);

    second.doc.getText("body_en").insert(5, ", world");
    await settle();
    expect(first.doc.getText("body_en").toString()).toBe("Hello, world");

    first.destroy();
    second.destroy();
  });
});

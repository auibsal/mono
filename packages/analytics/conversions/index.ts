import "server-only";
import { project } from "@repo/config";
import {
  type AnalyticsEvent,
  defaultEventId,
  type EventProperties,
  toMeta,
  toTikTok,
} from "../events";
import { keys } from "../keys";
import { buildMetaEvent, type MetaOptions, sendMetaEvents } from "./meta";
import {
  buildTikTokEvent,
  sendTikTokEvents,
  type TikTokOptions,
} from "./tiktok";
import type { ConversionContext } from "./types";

export interface ConversionResult {
  destination: "meta" | "tiktok";
  error?: unknown;
  ok: boolean;
}

interface ConversionsOptions {
  currency?: string;
  fetch?: typeof fetch;
  meta?: MetaOptions;
  tiktok?: TikTokOptions;
}

/**
 * Server-side conversions: the same event catalogue as `track()` in the
 * browser, sent to the Meta Conversions API and TikTok Events API. Use the
 * same event id in both places and the platforms count the event once.
 */
export const createConversions = ({
  currency = project.region.currency,
  fetch: fetchImpl = fetch,
  meta,
  tiktok,
}: ConversionsOptions) => ({
  enabled: Boolean(meta || tiktok),

  async track<E extends AnalyticsEvent>(
    event: E,
    properties: EventProperties[E],
    context: ConversionContext = {}
  ): Promise<ConversionResult[]> {
    const withId = {
      ...context,
      eventId:
        context.eventId ??
        defaultEventId(event, properties) ??
        crypto.randomUUID(),
    };
    const sends: Promise<ConversionResult>[] = [];

    const metaEvent = meta ? toMeta(event, properties, currency) : null;
    if (meta && metaEvent) {
      sends.push(
        sendMetaEvents(
          [buildMetaEvent(metaEvent, withId)],
          meta,
          fetchImpl
        ).then(
          () => ({ destination: "meta", ok: true }),
          (error: unknown) => ({ destination: "meta", error, ok: false })
        )
      );
    }

    const tiktokEvent = tiktok ? toTikTok(event, properties, currency) : null;
    if (tiktok && tiktokEvent) {
      sends.push(
        sendTikTokEvents(
          [buildTikTokEvent(tiktokEvent, withId)],
          tiktok,
          fetchImpl
        ).then(
          () => ({ destination: "tiktok", ok: true }),
          (error: unknown) => ({ destination: "tiktok", error, ok: false })
        )
      );
    }

    return await Promise.all(sends);
  },
});

export type Conversions = ReturnType<typeof createConversions>;

let conversions: Conversions | undefined;

/** Conversions for the destinations that have a pixel id and a token. */
export const getConversions = () => {
  if (!conversions) {
    const env = keys();
    conversions = createConversions({
      meta:
        env.NEXT_PUBLIC_META_PIXEL_ID && env.META_CONVERSIONS_ACCESS_TOKEN
          ? {
              accessToken: env.META_CONVERSIONS_ACCESS_TOKEN,
              pixelId: env.NEXT_PUBLIC_META_PIXEL_ID,
              testEventCode: env.META_TEST_EVENT_CODE,
            }
          : undefined,
      tiktok:
        env.NEXT_PUBLIC_TIKTOK_PIXEL_ID && env.TIKTOK_EVENTS_ACCESS_TOKEN
          ? {
              accessToken: env.TIKTOK_EVENTS_ACCESS_TOKEN,
              pixelId: env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
              testEventCode: env.TIKTOK_TEST_EVENT_CODE,
            }
          : undefined,
    });
  }
  return conversions;
};

export {
  attributionSchema,
  collectAttribution,
  readAttribution,
} from "./attribution";
export type { Attribution, ConversionContext, ConversionUser } from "./types";
export { ConversionError } from "./types";

import type { MappedEvent } from "../events";
import {
  compact,
  normalizeEmail,
  phoneDigits,
  sha256,
  unixSeconds,
} from "./hash";
import {
  type ConversionContext,
  ConversionError,
  REQUEST_TIMEOUT_MS,
} from "./types";

export const TIKTOK_EVENTS_URL =
  "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export interface TikTokOptions {
  accessToken: string;
  pixelId: string;
  /** From Events Manager → Test events. */
  testEventCode?: string;
}

/** One Events API 2.0 web event. */
export const buildTikTokEvent = (
  event: MappedEvent,
  { attribution, eventId, eventTime = new Date(), user }: ConversionContext
) => ({
  event: event.name,
  event_id: eventId,
  event_time: unixSeconds(eventTime),
  page: compact({ url: attribution?.sourceUrl }),
  properties: event.params,
  user: compact({
    email: user?.email ? sha256(normalizeEmail(user.email)) : undefined,
    external_id: user?.externalId ? sha256(user.externalId) : undefined,
    ip: attribution?.ipAddress,
    phone: user?.phone ? sha256(`+${phoneDigits(user.phone)}`) : undefined,
    ttclid: attribution?.ttclid,
    ttp: attribution?.ttp,
    user_agent: attribution?.userAgent,
  }),
});

export type TikTokEvent = ReturnType<typeof buildTikTokEvent>;

export const sendTikTokEvents = async (
  events: TikTokEvent[],
  { accessToken, pixelId, testEventCode }: TikTokOptions,
  fetchImpl: typeof fetch = fetch
) => {
  const response = await fetchImpl(TIKTOK_EVENTS_URL, {
    body: JSON.stringify({
      data: events,
      event_source: "web",
      event_source_id: pixelId,
      test_event_code: testEventCode,
    }),
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
  };

  // TikTok reports most errors as HTTP 200 with a non-zero code.
  if (!response.ok || body.code !== 0) {
    throw new ConversionError(
      "tiktok",
      response.status,
      `${body.code ?? "?"} ${body.message ?? response.statusText}`
    );
  }
};

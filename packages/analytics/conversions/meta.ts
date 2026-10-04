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

/** Graph API version for the Conversions API; bump when Meta retires it. */
export const META_API_VERSION = "v25.0";

export interface MetaOptions {
  accessToken: string;
  apiVersion?: string;
  pixelId: string;
  /** From Events Manager → Test events; sends to the test feed only. */
  testEventCode?: string;
}

/**
 * One Conversions API event. Events captured in a browser are "website"
 * events (which require the user agent); anything else is reported as
 * "system_generated".
 */
export const buildMetaEvent = (
  event: MappedEvent,
  { attribution, eventId, eventTime = new Date(), user }: ConversionContext
) => ({
  action_source: attribution?.userAgent ? "website" : "system_generated",
  custom_data: event.params,
  event_id: eventId,
  event_name: event.name,
  event_source_url: attribution?.sourceUrl,
  event_time: unixSeconds(eventTime),
  user_data: compact({
    client_ip_address: attribution?.ipAddress,
    client_user_agent: attribution?.userAgent,
    em: user?.email ? [sha256(normalizeEmail(user.email))] : undefined,
    external_id: user?.externalId ? [sha256(user.externalId)] : undefined,
    fbc: attribution?.fbc,
    fbp: attribution?.fbp,
    ph: user?.phone ? [sha256(phoneDigits(user.phone))] : undefined,
  }),
});

export type MetaEvent = ReturnType<typeof buildMetaEvent>;

export const sendMetaEvents = async (
  events: MetaEvent[],
  {
    accessToken,
    apiVersion = META_API_VERSION,
    pixelId,
    testEventCode,
  }: MetaOptions,
  fetchImpl: typeof fetch = fetch
) => {
  const response = await fetchImpl(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events`,
    {
      // The token goes in the body, not the URL, to keep it out of logs.
      body: JSON.stringify({
        access_token: accessToken,
        data: events,
        test_event_code: testEventCode,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new ConversionError("meta", response.status, await response.text());
  }
};

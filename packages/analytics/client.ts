import { project } from "@repo/config";
import posthog from "posthog-js";
import { type ConsentState, toGoogleConsent } from "./consent";
import {
  type AnalyticsEvent,
  defaultEventId,
  type EventProperties,
  toGa4,
  toMeta,
  toTikTok,
} from "./events";

type Command = (...args: unknown[]) => void;

interface TikTok {
  grantConsent: Command;
  page: Command;
  revokeConsent: Command;
  track: Command;
}

interface AnalyticsWindow {
  __analyticsMode?: "direct" | "gtm";
  Capacitor?: { isNativePlatform?: () => boolean };
  dataLayer?: unknown[];
  fbq?: Command;
  gtag?: Command;
  ttq?: TikTok;
}

const CLICK_ID_STORAGE = "analytics:click-ids";

const browser = () =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as AnalyticsWindow);

/** True inside the Capacitor iOS/Android apps. */
export const isNativeApp = () =>
  browser()?.Capacitor?.isNativePlatform?.() === true;

const posthogReady = () => Boolean(posthog.__loaded);

/**
 * Records an event in every configured destination. With Google Tag Manager
 * the event is pushed to the data layer as:
 *
 *   { event: <GA4 name>, event_id, ecommerce: <GA4 params>,
 *     meta: { event, params }, tiktok: { event, params } }
 *
 * so one Meta tag and one TikTok tag in the container can forward every
 * event using those variables.
 */
export const track = <E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties[E],
  { eventId = defaultEventId(event, properties) }: { eventId?: string } = {}
) => {
  const w = browser();
  if (!w) {
    return;
  }
  if (posthogReady()) {
    posthog.capture(event, properties);
  }

  const { currency } = project.region;
  const ga4 = toGa4(event, properties, currency);
  const meta = toMeta(event, properties, currency);
  const tiktok = toTikTok(event, properties, currency);

  if (w.__analyticsMode === "gtm") {
    w.dataLayer?.push({ ecommerce: null, meta: null, tiktok: null });
    w.dataLayer?.push({
      ecommerce: ga4.params,
      event: ga4.name,
      event_id: eventId,
      meta: meta ? { event: meta.name, params: meta.params } : undefined,
      tiktok: tiktok
        ? { event: tiktok.name, params: tiktok.params }
        : undefined,
    });
    return;
  }

  w.gtag?.("event", ga4.name, ga4.params);
  if (meta) {
    w.fbq?.(
      "track",
      meta.name,
      meta.params,
      eventId ? { eventID: eventId } : {}
    );
  }
  if (tiktok) {
    w.ttq?.track(
      tiktok.name,
      tiktok.params,
      eventId ? { event_id: eventId } : {}
    );
  }
};

/** Sent by the page-view tracker on every navigation. */
export const trackPageView = (url: string) => {
  const w = browser();
  if (!w) {
    return;
  }
  if (w.__analyticsMode === "gtm") {
    w.dataLayer?.push({ event: "virtual_page_view", page_location: url });
    return;
  }
  w.gtag?.("event", "page_view", { page_location: url });
  w.fbq?.("track", "PageView");
  w.ttq?.page();
};

/** Applies the visitor's choice from a consent banner. */
export const setConsent = (consent: ConsentState) => {
  const w = browser();
  if (!w) {
    return;
  }
  w.gtag?.("consent", "update", toGoogleConsent(consent));
  w.fbq?.("consent", consent.ads ? "grant" : "revoke");
  if (consent.ads) {
    w.ttq?.grantConsent();
  } else {
    w.ttq?.revokeConsent();
  }
  if (posthogReady()) {
    if (consent.analytics) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }
};

/** Links events to a signed-in user in product analytics (PostHog). */
export const identify = (userId: string, traits?: Record<string, unknown>) => {
  if (posthogReady()) {
    posthog.identify(userId, traits);
  }
};

/** Call on sign-out so the next visitor on this device starts fresh. */
export const resetIdentity = () => {
  if (posthogReady()) {
    posthog.reset();
  }
};

/** Keeps ad click ids from the landing URL for the rest of the visit. */
export const rememberClickIds = () => {
  const params = new URLSearchParams(window.location.search);
  const ids = Object.fromEntries(
    ["fbclid", "ttclid"].flatMap((key) => {
      const value = params.get(key);
      return value ? [[key, value]] : [];
    })
  );
  if (Object.keys(ids).length === 0) {
    return;
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem(CLICK_ID_STORAGE) ?? "{}");
    sessionStorage.setItem(
      CLICK_ID_STORAGE,
      JSON.stringify({ ...stored, ...ids, at: Date.now() })
    );
  } catch {
    // Storage can be unavailable (private mode); attribution is best effort.
  }
};

const readCookie = (name: string) =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const readClickIds = (): { at?: number; fbclid?: string; ttclid?: string } => {
  try {
    return JSON.parse(sessionStorage.getItem(CLICK_ID_STORAGE) ?? "{}");
  } catch {
    return {};
  }
};

/**
 * Browser identifiers for server-side conversions. Send them with the
 * checkout request so the purchase reported from the payment webhook is
 * matched to the ad click. Returns nothing inside the native apps.
 */
export const getAttribution = () => {
  if (!browser() || isNativeApp()) {
    return;
  }
  const clicks = readClickIds();
  const fbp = readCookie("_fbp");
  const fbc =
    readCookie("_fbc") ??
    (clicks.fbclid
      ? `fb.1.${clicks.at ?? Date.now()}.${clicks.fbclid}`
      : undefined);

  return {
    fbc,
    fbp,
    sourceUrl: window.location.href,
    ttclid: clicks.ttclid,
    ttp: readCookie("_ttp"),
  };
};

export type { ConsentState } from "./consent";
export type { AnalyticsEvent, AnalyticsItem, EventProperties } from "./events";

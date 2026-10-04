export { posthog as analytics } from "posthog-js";
export type {
  AnalyticsEvent,
  AnalyticsItem,
  ConsentState,
  EventProperties,
} from "./client";
export {
  getAttribution,
  identify,
  isNativeApp,
  resetIdentity,
  setConsent,
  track,
  trackPageView,
} from "./client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import Script from "next/script";
import { type ReactNode, Suspense } from "react";
import { bootstrapScript } from "./bootstrap";
import {
  CONSENT_REQUIRED_REGIONS,
  type ConsentState,
  toGoogleConsent,
} from "./consent";
import { keys } from "./keys";
import { PageViewTracker } from "./page-view";

interface AnalyticsProviderProps {
  readonly children: ReactNode;
  /**
   * Consent before the visitor makes a choice. Granted by default; visitors
   * in the EEA, UK and Switzerland always start denied for Google tags. Pass
   * `{ ads: false, analytics: false }` when the project shows a consent
   * banner, then call `setConsent` from `@repo/analytics/client`.
   */
  readonly defaultConsent?: ConsentState;
}

const env = keys();

/**
 * Loads Google Tag Manager, or GA4, Meta Pixel and TikTok Pixel directly,
 * for whichever IDs are configured, plus Vercel Web Analytics on Vercel.
 * Render it once, in the root layout.
 */
export const AnalyticsProvider = ({
  children,
  defaultConsent = { ads: true, analytics: true },
}: AnalyticsProviderProps) => {
  const tags = {
    gaId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    gtmId: env.NEXT_PUBLIC_GTM_ID,
    metaPixelId: env.NEXT_PUBLIC_META_PIXEL_ID,
    tiktokPixelId: env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  };
  const hasTags = Object.values(tags).some(Boolean);

  return (
    <>
      {children}
      {hasTags ? (
        <>
          {/* biome-ignore lint/correctness/noBeforeInteractiveScriptOutsideDocument: App Router supports beforeInteractive in the root layout, where this provider is rendered */}
          <Script id="analytics-bootstrap" strategy="beforeInteractive">
            {bootstrapScript({
              ...tags,
              consent: toGoogleConsent(defaultConsent),
              consentRequiredRegions: CONSENT_REQUIRED_REGIONS,
              holdAdsConsent: !defaultConsent.ads,
            })}
          </Script>
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
        </>
      ) : null}
      {env.NEXT_PUBLIC_VERCEL_ENV ? <VercelAnalytics /> : null}
    </>
  );
};

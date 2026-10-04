import Script from "next/script";
import type { ReactNode } from "react";
import { keys } from "./keys";

interface AnalyticsProviderProps {
  readonly children: ReactNode;
}

/**
 * GA4 for the public site, loaded only when NEXT_PUBLIC_GA_ID is set. No
 * Meta or TikTok pixels, no server-side conversions, no advertising
 * features. Render once, in apps/web's layout.
 */
export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const gaId = keys().NEXT_PUBLIC_GA_ID;

  return (
    <>
      {children}
      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      ) : null}
    </>
  );
};

import Script from "next/script";
import type { ReactNode } from "react";
import { keys } from "./keys";

const SCRIPT_UNSAFE_CHAR_MAP: Record<string, string> = {
  "/": "\\u002F",
  "\\": "\\\\",
  "\0": "\\0",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
  "<": "\\u003C",
  ">": "\\u003E",
};

const escapeUnsafeScriptChars = (value: string): string =>
  value.replace(
    /[<>/\\\b\f\n\r\t\0\u2028\u2029]/g,
    (char) => SCRIPT_UNSAFE_CHAR_MAP[char] ?? char
  );

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
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${escapeUnsafeScriptChars(JSON.stringify(gaId))},{allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      ) : null}
    </>
  );
};

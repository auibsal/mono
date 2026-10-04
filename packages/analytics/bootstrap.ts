/* biome-ignore-all lint/complexity/noArguments: the vendor stubs queue `arguments` objects, which their loaders expect */
/* biome-ignore-all lint/complexity/useArrowFunction: the stubs need `arguments`, which arrow functions don't have */
/* biome-ignore-all lint/suspicious/noExplicitAny: vendor globals are untyped */
import type { GoogleConsent } from "./consent";

export interface BootstrapConfig {
  /** Consent mode default for every region not listed below. */
  consent: GoogleConsent;
  /** Regions that start denied regardless of `consent`. */
  consentRequiredRegions: string[];
  gaId?: string;
  gtmId?: string;
  /** Queue Meta and TikTok until `setConsent({ ads: true })`. */
  holdAdsConsent: boolean;
  metaPixelId?: string;
  tiktokPixelId?: string;
}

/**
 * Sets Consent Mode defaults and loads the tags. It is serialized into an
 * inline script that runs before hydration, so it must stay self-contained:
 * no imports, no outer variables, syntax every target browser runs as is.
 *
 * Inside the Capacitor apps nothing loads: web pixels in a native app need
 * App Tracking Transparency consent on iOS, so app campaigns should use the
 * vendors' mobile SDKs instead.
 */
export function analyticsBootstrap(config: BootstrapConfig) {
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.()) {
    return;
  }

  const load = (src: string) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };

  w.dataLayer = w.dataLayer || [];
  w.gtag =
    w.gtag ||
    function () {
      w.dataLayer.push(arguments);
    };
  w.gtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied",
    region: config.consentRequiredRegions,
    wait_for_update: 500,
  });
  w.gtag("consent", "default", config.consent);

  if (config.gtmId) {
    w.__analyticsMode = "gtm";
    w.dataLayer.push({ event: "gtm.js", "gtm.start": Date.now() });
    load(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`
    );
    return;
  }

  w.__analyticsMode = "direct";

  if (config.gaId) {
    w.gtag("js", new Date());
    // Page views are sent by the page-view tracker on every navigation.
    w.gtag("config", config.gaId, { send_page_view: false });
    load(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.gaId)}`
    );
  }

  if (config.metaPixelId && !w.fbq) {
    const fbq: any = function () {
      if (fbq.callMethod) {
        fbq.callMethod(...arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };
    w.fbq = fbq;
    w._fbq = w._fbq || fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    if (config.holdAdsConsent) {
      fbq("consent", "revoke");
    }
    fbq("init", config.metaPixelId);
    load("https://connect.facebook.net/en_US/fbevents.js");
  }

  if (config.tiktokPixelId && !w.ttq) {
    const methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent",
    ];
    const ttq: any = [];
    const defer = (target: any, method: string) => {
      target[method] = function () {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    w.TiktokAnalyticsObject = "ttq";
    w.ttq = ttq;
    ttq.methods = methods;
    ttq.setAndDefer = defer;
    for (const method of methods) {
      defer(ttq, method);
    }
    ttq.instance = function (id: string) {
      const instance = ttq._i[id] || [];
      for (const method of methods) {
        defer(instance, method);
      }
      return instance;
    };
    ttq.load = function (id: string, options?: object) {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};
      load(`${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
    };
    if (config.holdAdsConsent) {
      ttq.holdConsent();
    }
    ttq.load(config.tiktokPixelId);
  }
}

/** The inline script source, safe to embed in HTML. */
export const bootstrapScript = (config: BootstrapConfig) =>
  `(${analyticsBootstrap.toString()})(${JSON.stringify(config).replace(/</g, "\\u003c")});`;

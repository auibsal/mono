import { describe, expect, it } from "vitest";
import { type BootstrapConfig, bootstrapScript } from "./bootstrap";
import { CONSENT_REQUIRED_REGIONS, toGoogleConsent } from "./consent";

interface FakeWindow {
  dataLayer?: unknown[][];
  [key: string]: unknown;
}

const config = (overrides: Partial<BootstrapConfig> = {}): BootstrapConfig => ({
  consent: toGoogleConsent({ ads: true, analytics: true }),
  consentRequiredRegions: CONSENT_REQUIRED_REGIONS,
  holdAdsConsent: false,
  ...overrides,
});

/** Runs the serialized script the way a browser would: no module scope. */
const run = (source: string, win: FakeWindow = {}) => {
  const loaded: string[] = [];
  const document = {
    createElement: () => ({}) as { src?: string },
    head: { appendChild: (script: { src: string }) => loaded.push(script.src) },
  };
  new Function("window", "document", source)(win, document);
  return { loaded, win };
};

describe("analytics bootstrap", () => {
  it("is self-contained once serialized", () => {
    expect(() => run(bootstrapScript(config()))).not.toThrow();
  });

  it("sets regional and default consent before loading Google Tag Manager", () => {
    const { loaded, win } = run(bootstrapScript(config({ gtmId: "GTM-ABC" })));

    const [regional, fallback] = (win.dataLayer ?? []).map((entry) =>
      Array.from(entry as ArrayLike<unknown>)
    );
    expect(regional?.slice(0, 2)).toEqual(["consent", "default"]);
    expect(regional?.[2]).toMatchObject({
      ad_storage: "denied",
      region: expect.arrayContaining(["DE", "GB"]),
    });
    expect(fallback?.[2]).toMatchObject({ ad_storage: "granted" });
    expect(loaded).toEqual([
      "https://www.googletagmanager.com/gtm.js?id=GTM-ABC",
    ]);
    expect(win.__analyticsMode).toBe("gtm");
    expect(win.fbq).toBeUndefined();
  });

  it("loads GA4, Meta and TikTok directly without a container", () => {
    const { loaded, win } = run(
      bootstrapScript(
        config({
          gaId: "G-TEST",
          holdAdsConsent: true,
          metaPixelId: "123",
          tiktokPixelId: "CABC",
        })
      )
    );

    expect(loaded).toEqual([
      "https://www.googletagmanager.com/gtag/js?id=G-TEST",
      "https://connect.facebook.net/en_US/fbevents.js",
      "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CABC&lib=ttq",
    ]);
    const fbq = win.fbq as { queue: ArrayLike<unknown>[] };
    expect(fbq.queue.map((call) => Array.from(call))).toEqual([
      ["consent", "revoke"],
      ["init", "123"],
    ]);
    expect(Array.from(win.ttq as unknown[])).toEqual([["holdConsent"]]);
  });

  it("loads nothing inside the native apps", () => {
    const { loaded, win } = run(bootstrapScript(config({ metaPixelId: "1" })), {
      Capacitor: { isNativePlatform: () => true },
    });
    expect(loaded).toEqual([]);
    expect(win.dataLayer).toBeUndefined();
  });

  it("escapes markup in the embedded config", () => {
    expect(bootstrapScript(config({ gtmId: "GTM-</script>" }))).not.toContain(
      "</script>"
    );
  });
});

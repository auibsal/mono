import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { collectAttribution, createConversions, readAttribution } = await import(
  "./index"
);
const { buildMetaEvent } = await import("./meta");
const { buildTikTokEvent } = await import("./tiktok");

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

const context = {
  attribution: {
    fbc: "fb.1.1700000000000.abc",
    fbp: "fb.1.1700000000000.123",
    ipAddress: "185.1.2.3",
    sourceUrl: "https://app.example.com/billing",
    ttclid: "ttclid-1",
    ttp: "ttp-1",
    userAgent: "Mozilla/5.0",
  },
  eventId: "purchase:pay_1",
  eventTime: new Date("2026-10-03T12:00:00Z"),
  user: {
    email: " Owner@Example.com ",
    externalId: "user-1",
    phone: "+964 770 123 4567",
  },
};

const event = { name: "Purchase", params: { currency: "IQD", value: 5000 } };

describe("server events", () => {
  it("hashes identifiers the way Meta expects", () => {
    const payload = buildMetaEvent(event, context);
    expect(payload).toMatchObject({
      action_source: "website",
      custom_data: { currency: "IQD", value: 5000 },
      event_id: "purchase:pay_1",
      event_name: "Purchase",
      event_source_url: "https://app.example.com/billing",
      event_time: 1_791_028_800,
    });
    expect(payload.user_data).toEqual({
      client_ip_address: "185.1.2.3",
      client_user_agent: "Mozilla/5.0",
      em: [sha("owner@example.com")],
      external_id: [sha("user-1")],
      fbc: "fb.1.1700000000000.abc",
      fbp: "fb.1.1700000000000.123",
      ph: [sha("9647701234567")],
    });
  });

  it("hashes the phone in E.164 for TikTok", () => {
    const payload = buildTikTokEvent(event, context);
    expect(payload.user).toEqual({
      email: sha("owner@example.com"),
      external_id: sha("user-1"),
      ip: "185.1.2.3",
      phone: sha("+9647701234567"),
      ttclid: "ttclid-1",
      ttp: "ttp-1",
      user_agent: "Mozilla/5.0",
    });
    expect(payload.page).toEqual({ url: "https://app.example.com/billing" });
  });

  it("reports events without browser context as system generated", () => {
    expect(buildMetaEvent(event, {}).action_source).toBe("system_generated");
  });
});

describe("createConversions", () => {
  const ok = (body: object = {}) =>
    new Response(JSON.stringify(body), { status: 200 });

  it("sends one purchase to both platforms with the same event id", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("tiktok")
        ? ok({ code: 0 })
        : ok({ events_received: 1 })
    );
    const conversions = createConversions({
      currency: "IQD",
      fetch: fetchMock as typeof fetch,
      meta: {
        accessToken: "meta-token",
        pixelId: "123",
        testEventCode: "TEST1",
      },
      tiktok: { accessToken: "tt-token", pixelId: "CABC" },
    });

    const results = await conversions.track(
      "purchase",
      { transactionId: "pay_1", value: 5000 },
      { attribution: context.attribution }
    );

    expect(results).toEqual([
      { destination: "meta", ok: true },
      { destination: "tiktok", ok: true },
    ]);

    const [metaUrl, metaInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(metaUrl).toBe("https://graph.facebook.com/v25.0/123/events");
    const metaBody = JSON.parse(String(metaInit.body));
    expect(metaBody).toMatchObject({
      access_token: "meta-token",
      data: [{ event_id: "purchase:pay_1", event_name: "Purchase" }],
      test_event_code: "TEST1",
    });

    const [tiktokUrl, tiktokInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(tiktokUrl).toBe(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/"
    );
    expect(new Headers(tiktokInit.headers).get("Access-Token")).toBe(
      "tt-token"
    );
    expect(JSON.parse(String(tiktokInit.body))).toMatchObject({
      data: [{ event: "Purchase", event_id: "purchase:pay_1" }],
      event_source: "web",
      event_source_id: "CABC",
    });
  });

  it("reports failures without throwing, including TikTok's 200 errors", async () => {
    const conversions = createConversions({
      fetch: (async (url: string | URL | Request) =>
        String(url).includes("tiktok")
          ? ok({ code: 40_001, message: "Invalid token" })
          : new Response("bad", { status: 400 })) as typeof fetch,
      meta: { accessToken: "a", pixelId: "1" },
      tiktok: { accessToken: "b", pixelId: "C" },
    });

    const results = await conversions.track("purchase", {
      transactionId: "pay_2",
      value: 1000,
    });

    expect(
      results.map(({ destination, ok: sent }) => [destination, sent])
    ).toEqual([
      ["meta", false],
      ["tiktok", false],
    ]);
    expect(String(results[1]?.error)).toContain("Invalid token");
  });

  it("skips events a platform has no equivalent for", async () => {
    const fetchMock = vi.fn();
    const conversions = createConversions({
      fetch: fetchMock,
      meta: { accessToken: "a", pixelId: "1" },
    });
    expect(await conversions.track("login", { method: "phone" })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createConversions({}).enabled).toBe(false);
  });
});

describe("attribution", () => {
  it("takes the IP from the platform header and the browser identifiers", () => {
    const request = new Request("https://api.example.com/checkout", {
      headers: {
        "user-agent": "Mozilla/5.0",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        "x-real-ip": "185.1.2.3",
      },
    });
    expect(collectAttribution(request, { fbp: "fb.1.2.3" })).toEqual({
      fbp: "fb.1.2.3",
      ipAddress: "185.1.2.3",
      userAgent: "Mozilla/5.0",
    });
  });

  it("reads stored attribution and ignores anything else", () => {
    expect(readAttribution({ attribution: { userAgent: "UA" } })).toEqual({
      userAgent: "UA",
    });
    expect(readAttribution({})).toBeUndefined();
    expect(readAttribution({ attribution: "nope" })).toBeUndefined();
    expect(readAttribution(null)).toBeUndefined();
  });
});

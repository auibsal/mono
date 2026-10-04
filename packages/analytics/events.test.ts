import { describe, expect, it } from "vitest";
import { toGoogleConsent } from "./consent";
import { defaultEventId, toGa4, toMeta, toTikTok } from "./events";

const purchase = {
  items: [{ id: "plan_pro", name: "Pro", price: 25_000, quantity: 1 }],
  transactionId: "pay_123",
  value: 25_000,
};

describe("event mapping", () => {
  it("maps a purchase to each platform's standard event", () => {
    expect(toGa4("purchase", purchase, "IQD")).toEqual({
      name: "purchase",
      params: {
        currency: "IQD",
        items: [
          { item_id: "plan_pro", item_name: "Pro", price: 25_000, quantity: 1 },
        ],
        transaction_id: "pay_123",
        value: 25_000,
      },
    });
    expect(toMeta("purchase", purchase, "IQD")).toEqual({
      name: "Purchase",
      params: {
        content_ids: ["plan_pro"],
        content_type: "product",
        contents: [{ id: "plan_pro", item_price: 25_000, quantity: 1 }],
        currency: "IQD",
        num_items: 1,
        order_id: "pay_123",
        value: 25_000,
      },
    });
    expect(toTikTok("purchase", purchase, "IQD")).toEqual({
      name: "Purchase",
      params: {
        content_type: "product",
        contents: [
          {
            content_id: "plan_pro",
            content_name: "Pro",
            price: 25_000,
            quantity: 1,
          },
        ],
        currency: "IQD",
        order_id: "pay_123",
        value: 25_000,
      },
    });
  });

  it("uses each platform's name for registrations and leads", () => {
    expect(toGa4("sign_up", { method: "phone" }, "IQD")).toEqual({
      name: "sign_up",
      params: { method: "phone" },
    });
    expect(toMeta("sign_up", { method: "phone" }, "IQD")?.name).toBe(
      "CompleteRegistration"
    );
    expect(toTikTok("generate_lead", {}, "IQD")?.name).toBe("Lead");
    expect(toMeta("search", { query: "desk" }, "IQD")?.params).toEqual({
      search_string: "desk",
    });
  });

  it("skips platforms without an equivalent event", () => {
    expect(toMeta("login", { method: "phone" }, "IQD")).toBeNull();
    expect(toTikTok("login", { method: "phone" }, "IQD")).toBeNull();
  });

  it("keeps an explicit currency and omits it without a value", () => {
    expect(
      toGa4("begin_checkout", { currency: "USD", value: 20 }, "IQD").params
    ).toEqual({ currency: "USD", value: 20 });
    expect(toGa4("view_item", { items: [{ id: "a" }] }, "IQD").params).toEqual({
      items: [{ item_id: "a" }],
    });
  });

  it("derives a stable event id from the order", () => {
    expect(defaultEventId("purchase", purchase)).toBe("purchase:pay_123");
    expect(defaultEventId("search", { query: "x" })).toBeUndefined();
  });
});

describe("consent", () => {
  it("maps to Google Consent Mode v2", () => {
    expect(toGoogleConsent({ ads: false, analytics: true })).toEqual({
      ad_personalization: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      analytics_storage: "granted",
    });
  });
});

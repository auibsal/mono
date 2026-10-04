import { createHmac } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { PaymentProviderError, WebhookVerificationError } from "../types";
import {
  createWaylProvider,
  toCheckoutStatus,
  verifyWaylSignature,
} from "./wayl";

const secret = "test-webhook-secret";

const link = {
  completedAt: null,
  currency: "IQD",
  id: "cmlink_1",
  paymentMethod: null,
  referenceId: "order-1",
  status: "Created",
  total: "25000",
  url: "https://checkout.thewayl.com/pay/ABC123",
};

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    })
  );

const provider = (fetchMock: ReturnType<typeof vi.fn>) =>
  createWaylProvider({
    apiKey: "merchant-token",
    environment: "test",
    fetch: fetchMock as unknown as typeof fetch,
    webhookSecret: secret,
  });

describe("Wayl provider", () => {
  test("creates a payment link with the documented payload", async () => {
    const fetchMock = respond(201, {
      data: link,
      message: "Link created successfully.",
    });

    const checkout = await provider(fetchMock).createCheckout({
      amount: { amount: 25_000, currency: "IQD" },
      expiresInMinutes: 60,
      lineItems: [{ amount: 25_000, label: "Pro plan" }],
      redirectUrl: "https://app.example.iq/billing",
      referenceId: "order-1",
      webhookUrl: "https://api.example.iq/webhooks/payments",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.thewayl.com/api/v1/links");
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>)["X-WAYL-AUTHENTICATION"]
    ).toBe("merchant-token");
    expect(JSON.parse(init.body as string)).toEqual({
      currency: "IQD",
      env: "test",
      lineItem: [{ amount: 25_000, label: "Pro plan", type: "increase" }],
      linkExpiresIn: "60m",
      redirectionUrl: "https://app.example.iq/billing",
      referenceId: "order-1",
      total: 25_000,
      webhookSecret: secret,
      webhookUrl: "https://api.example.iq/webhooks/payments",
    });
    expect(checkout).toMatchObject({
      amount: { amount: 25_000, currency: "IQD" },
      providerReference: "cmlink_1",
      status: "pending",
      url: link.url,
    });
  });

  test.each([
    [{ amount: 999, currency: "IQD" }, "at least 1000"],
    [{ amount: 1500.5, currency: "IQD" }, "whole amount"],
    [{ amount: 5000, currency: "USD" }, "only supports IQD"],
  ])("rejects invalid amounts %o", async (amount, message) => {
    const fetchMock = respond(201, { data: link });
    await expect(
      provider(fetchMock).createCheckout({ amount, referenceId: "x" })
    ).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects line items that don't add up", async () => {
    await expect(
      provider(respond(201, { data: link })).createCheckout({
        amount: { amount: 10_000, currency: "IQD" },
        lineItems: [
          { amount: 12_000, label: "Plan" },
          { amount: 1000, label: "Discount", type: "decrease" },
        ],
        referenceId: "x",
      })
    ).rejects.toThrow("add up");
  });

  test("maps link statuses", () => {
    expect(toCheckoutStatus("Complete")).toBe("paid");
    expect(toCheckoutStatus("Delivered")).toBe("paid");
    expect(toCheckoutStatus("Processing")).toBe("processing");
    expect(toCheckoutStatus("Rejected")).toBe("failed");
    expect(toCheckoutStatus("Cancelled")).toBe("canceled");
    expect(toCheckoutStatus("Returned")).toBe("refunded");
    expect(toCheckoutStatus("SomethingNew")).toBe("pending");
  });

  test("reads a link by reference id and hides the URL once paid", async () => {
    const fetchMock = respond(200, {
      data: { ...link, paymentMethod: "Card", status: "Complete" },
    });
    const checkout = await provider(fetchMock).getCheckout("order/1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.thewayl.com/api/v1/links/order%2F1"
    );
    expect(checkout).toMatchObject({
      paymentMethod: "Card",
      status: "paid",
      url: null,
    });
  });

  test("surfaces API errors", async () => {
    const fetchMock = respond(422, { message: "referenceId already used" });
    await expect(provider(fetchMock).getCheckout("x")).rejects.toThrow(
      PaymentProviderError
    );
  });

  test("validates refunds before calling the API", async () => {
    const fetchMock = respond(201, {
      data: {
        amount: 5000,
        id: "r1",
        referenceId: "order-1",
        status: "Requested",
      },
    });
    const wayl = provider(fetchMock);

    await expect(
      wayl.refund({
        amount: { amount: 5000, currency: "IQD" },
        reason: "short",
        referenceId: "order-1",
      })
    ).rejects.toThrow("100–1500");

    const refund = await wayl.refund({
      amount: { amount: 5000, currency: "IQD" },
      reason: "Customer requested a refund. ".repeat(5),
      referenceId: "order-1",
    });
    expect(refund).toMatchObject({ id: "r1", status: "requested" });
  });

  test("verifies webhook signatures over the raw body", async () => {
    const rawBody = JSON.stringify({
      event: "order.created",
      referenceId: "order-1",
    });
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const wayl = provider(respond(200, {}));

    expect(verifyWaylSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyWaylSignature(`${rawBody} `, signature, secret)).toBe(false);
    expect(verifyWaylSignature(rawBody, "not-hex", secret)).toBe(false);
    expect(verifyWaylSignature(rawBody, null, secret)).toBe(false);

    const event = await wayl.parseWebhook({
      headers: new Headers({ "x-wayl-signature-256": signature }),
      rawBody,
    });
    expect(event).toMatchObject({ provider: "wayl", referenceId: "order-1" });
    expect(event.eventKey).toHaveLength(64);

    await expect(
      wayl.parseWebhook({
        headers: new Headers({ "x-wayl-signature-256": "00".repeat(32) }),
        rawBody,
      })
    ).rejects.toThrow(WebhookVerificationError);
  });
});

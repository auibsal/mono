import { describe, expect, test } from "vitest";
import { createMockProvider } from "../providers/mock";
import { WebhookVerificationError } from "../types";
import { createMemoryBillingRepository } from "./memory";
import type { PlanRecord } from "./repository";
import { addInterval, canTransition, createBillingService } from "./service";

const plan: PlanRecord = {
  active: true,
  amount: 25_000,
  billingInterval: "month",
  currency: "IQD",
  id: "pro-monthly",
  name: "Pro",
};

const setup = (now = new Date("2026-10-03T12:00:00Z")) => {
  const { repository, state } = createMemoryBillingRepository([
    plan,
    { ...plan, active: false, id: "retired" },
  ]);
  const provider = createMockProvider();
  let clock = now;
  const billing = createBillingService({
    now: () => clock,
    provider,
    repository,
    webhookUrl: "https://api.example.iq/webhooks/payments",
  });

  return {
    billing,
    provider,
    setNow: (date: Date) => {
      clock = date;
    },
    state,
  };
};

describe("billing", () => {
  test("adds billing intervals in UTC and clamps month ends", () => {
    expect(
      addInterval(new Date("2026-01-31T00:00:00Z"), "month").toISOString()
    ).toBe("2026-02-28T00:00:00.000Z");
    expect(
      addInterval(new Date("2028-02-29T10:00:00Z"), "year").toISOString()
    ).toBe("2029-02-28T10:00:00.000Z");
  });

  test("only allows forward payment transitions", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
    expect(canTransition("paid", "pending")).toBe(false);
    expect(canTransition("failed", "paid")).toBe(false);
  });

  test("starts a checkout for a plan", async () => {
    const { billing, state } = setup();
    const { referenceId, url } = await billing.startCheckout({
      organizationId: "org-1",
      planId: "pro-monthly",
      userId: "user-1",
    });

    expect(url).toContain(referenceId);
    expect(state.payments.get(referenceId)).toMatchObject({
      amount: 25_000,
      currency: "IQD",
      status: "pending",
    });
    expect([...state.subscriptions.values()]).toMatchObject([
      { organizationId: "org-1", planId: "pro-monthly", status: "incomplete" },
    ]);
  });

  test("refuses inactive plans", async () => {
    const { billing } = setup();
    await expect(
      billing.startCheckout({
        organizationId: "o",
        planId: "retired",
        userId: "u",
      })
    ).rejects.toThrow("not available");
  });

  test("a paid webhook activates the subscription exactly once", async () => {
    const { billing, provider, state } = setup();
    const attribution = { fbp: "fb.1.1.1", userAgent: "Mozilla/5.0" };
    const { referenceId } = await billing.startCheckout({
      metadata: { attribution },
      organizationId: "org-1",
      planId: "pro-monthly",
      userId: "user-1",
    });

    const delivery = provider.settle(referenceId, "paid");
    const outcome = await billing.handleWebhook(delivery);

    expect(outcome).toMatchObject({
      from: "pending",
      // Checkout metadata reaches the webhook for conversion reporting.
      payment: { metadata: { attribution } },
      status: "processed",
      to: "paid",
    });
    const [subscription] = [...state.subscriptions.values()];
    expect(subscription).toMatchObject({ status: "active" });
    expect(subscription?.currentPeriodEnd?.toISOString()).toBe(
      "2026-11-03T12:00:00.000Z"
    );

    // Providers retry deliveries; the second one must change nothing.
    expect(await billing.handleWebhook(delivery)).toEqual({
      status: "duplicate",
    });
    expect(
      [...state.subscriptions.values()][0]?.currentPeriodEnd?.toISOString()
    ).toBe("2026-11-03T12:00:00.000Z");
  });

  test("rejects forged webhooks", async () => {
    const { billing } = setup();
    await expect(
      billing.handleWebhook({
        headers: new Headers({ "x-mock-signature": "forged" }),
        rawBody: JSON.stringify({ referenceId: "x", status: "paid" }),
      })
    ).rejects.toThrow(WebhookVerificationError);
  });

  test("ignores webhooks for unknown payments", async () => {
    const { billing, provider } = setup();
    await provider.createCheckout({
      amount: { amount: 5000, currency: "IQD" },
      referenceId: "not-ours",
    });
    expect(
      await billing.handleWebhook(provider.settle("not-ours", "paid"))
    ).toEqual({
      reason: "unknown-payment",
      status: "ignored",
    });
  });

  test("never accepts a different amount than invoiced", async () => {
    const { billing, provider, state } = setup();
    const { referenceId } = await billing.startCheckout({
      organizationId: "org-1",
      planId: "pro-monthly",
      userId: "user-1",
    });
    const checkout = await provider.getCheckout(referenceId);
    checkout.amount = { amount: 1000, currency: "IQD" };

    const outcome = await billing.handleWebhook(
      provider.settle(referenceId, "paid")
    );

    expect(outcome).toMatchObject({ to: "failed" });
    expect(state.payments.get(referenceId)?.status).toBe("failed");
    expect([...state.subscriptions.values()][0]?.status).toBe("incomplete");
  });

  test("invoices renewals before the period ends, once", async () => {
    const { billing, provider, setNow, state } = setup();
    const { referenceId } = await billing.startCheckout({
      organizationId: "org-1",
      planId: "pro-monthly",
      userId: "user-1",
    });
    await billing.handleWebhook(provider.settle(referenceId, "paid"));

    setNow(new Date("2026-11-01T06:00:00Z"));
    const first = await billing.issueRenewals();
    expect(first.invoices).toHaveLength(1);
    expect(await billing.issueRenewals()).toMatchObject({ invoices: [] });

    // Paying the renewal early extends from the end of the current period.
    const [invoice] = first.invoices;
    await billing.handleWebhook(
      provider.settle(invoice?.referenceId ?? "", "paid")
    );
    expect(
      [...state.subscriptions.values()][0]?.currentPeriodEnd?.toISOString()
    ).toBe("2026-12-03T12:00:00.000Z");
  });

  test("marks overdue subscriptions past due, then expires them", async () => {
    const { billing, provider, setNow, state } = setup();
    const { referenceId } = await billing.startCheckout({
      organizationId: "org-1",
      planId: "pro-monthly",
      userId: "user-1",
    });
    await billing.handleWebhook(provider.settle(referenceId, "paid"));

    setNow(new Date("2026-11-05T00:00:00Z"));
    expect(await billing.issueRenewals()).toMatchObject({ pastDue: 1 });
    expect([...state.subscriptions.values()][0]?.status).toBe("past_due");

    setNow(new Date("2026-11-20T00:00:00Z"));
    expect(await billing.issueRenewals()).toMatchObject({ expired: 1 });
    expect([...state.subscriptions.values()][0]?.status).toBe("expired");
  });
});

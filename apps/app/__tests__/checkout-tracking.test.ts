import { beforeEach, describe, expect, test, vi } from "vitest";

const track = vi.fn();
vi.mock("@repo/analytics/client", () => ({ track }));

const { rememberCheckout, reportCompletedCheckout } = await import(
  "@/lib/checkout-tracking"
);

const checkout = {
  currency: "IQD",
  planId: "pro-monthly",
  planName: "Pro",
  referenceId: "pay_1",
  value: 75_000,
};

describe("purchase reporting after a hosted checkout", () => {
  beforeEach(() => {
    track.mockClear();
    sessionStorage.clear();
  });

  test("waits while the payment is unknown or pending", () => {
    rememberCheckout(checkout);

    expect(reportCompletedCheckout([])).toBe(false);
    expect(
      reportCompletedCheckout([{ reference_id: "pay_1", status: "pending" }])
    ).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  test("reports a paid checkout once, keyed by its reference", () => {
    rememberCheckout(checkout);
    const payments = [
      { reference_id: "pay_0", status: "paid" },
      { reference_id: "pay_1", status: "paid" },
    ];

    expect(reportCompletedCheckout(payments)).toBe(true);
    expect(reportCompletedCheckout(payments)).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      "purchase",
      expect.objectContaining({
        currency: "IQD",
        transactionId: "pay_1",
        value: 75_000,
      })
    );
  });

  test("forgets failed or expired checkouts without reporting", () => {
    rememberCheckout(checkout);

    expect(
      reportCompletedCheckout([{ reference_id: "pay_1", status: "expired" }])
    ).toBe(false);
    expect(
      reportCompletedCheckout([{ reference_id: "pay_1", status: "paid" }])
    ).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});

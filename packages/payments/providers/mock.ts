import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  type Checkout,
  type CheckoutStatus,
  type PaymentProvider,
  PaymentProviderError,
  WebhookVerificationError,
} from "../types";

/**
 * In-memory provider for local development and tests. State lives in the
 * process, so it only works when checkout and webhook run in the same
 * process (dev server, tests) — never in production.
 */

const SIGNATURE_HEADER = "x-mock-signature";

export interface MockProvider extends PaymentProvider {
  /** Simulates the customer finishing (or abandoning) the checkout. */
  settle: (
    referenceId: string,
    status: Extract<CheckoutStatus, "paid" | "failed" | "canceled">
  ) => { headers: Headers; rawBody: string };
}

export const createMockProvider = ({
  checkoutBaseUrl = "http://localhost:3002/mock-checkout",
  secret = "mock-webhook-secret",
}: {
  checkoutBaseUrl?: string;
  secret?: string;
} = {}): MockProvider => {
  const checkouts = new Map<string, Checkout>();
  const sign = (body: string) =>
    createHmac("sha256", secret).update(body).digest("hex");

  const find = (referenceId: string) => {
    const checkout = checkouts.get(referenceId);
    if (!checkout) {
      throw new PaymentProviderError(`Unknown checkout ${referenceId}`, 404);
    }
    return checkout;
  };

  return {
    cancelCheckout(referenceId) {
      const checkout = find(referenceId);
      if (checkout.status === "pending") {
        checkouts.set(referenceId, {
          ...checkout,
          status: "canceled",
          url: null,
        });
      }
      return Promise.resolve();
    },

    capabilities: { methods: ["card"], recurring: false, refunds: true },

    createCheckout(input) {
      if (checkouts.has(input.referenceId)) {
        return Promise.reject(
          new PaymentProviderError("referenceId must be unique", 422)
        );
      }

      const checkout: Checkout = {
        amount: input.amount,
        completedAt: null,
        paymentMethod: null,
        providerReference: randomUUID(),
        raw: input,
        referenceId: input.referenceId,
        status: "pending",
        url: `${checkoutBaseUrl}/${encodeURIComponent(input.referenceId)}`,
      };
      checkouts.set(input.referenceId, checkout);

      return Promise.resolve(checkout);
    },

    getCheckout(referenceId) {
      try {
        return Promise.resolve(find(referenceId));
      } catch (error) {
        return Promise.reject(error);
      }
    },

    id: "mock",

    parseWebhook({ headers, rawBody }) {
      if (headers.get(SIGNATURE_HEADER) !== sign(rawBody)) {
        return Promise.reject(new WebhookVerificationError());
      }
      const { referenceId } = JSON.parse(rawBody) as { referenceId: string };

      return Promise.resolve({
        eventKey: createHash("sha256").update(rawBody).digest("hex"),
        provider: "mock",
        raw: JSON.parse(rawBody),
        referenceId,
      });
    },

    refund({ amount, referenceId }) {
      const checkout = find(referenceId);
      checkouts.set(referenceId, { ...checkout, status: "refunded" });

      return Promise.resolve({
        amount,
        id: randomUUID(),
        raw: null,
        referenceId,
        status: "refunded",
      });
    },

    settle(referenceId, status) {
      const checkout = find(referenceId);
      checkouts.set(referenceId, {
        ...checkout,
        completedAt: status === "paid" ? new Date().toISOString() : null,
        paymentMethod: status === "paid" ? "card" : null,
        status,
        url: null,
      });

      const rawBody = JSON.stringify({ referenceId, status });
      return {
        headers: new Headers({ [SIGNATURE_HEADER]: sign(rawBody) }),
        rawBody,
      };
    },
  };
};

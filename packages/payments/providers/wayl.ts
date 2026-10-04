import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  type Checkout,
  type CheckoutInput,
  type CheckoutStatus,
  type PaymentEvent,
  type PaymentProvider,
  PaymentProviderError,
  type Refund,
  WebhookVerificationError,
} from "../types";

/**
 * Wayl (https://wayl.io) — Iraqi payment links with a hosted checkout that
 * accepts cards, Qi Card, ZainCash, FIB and other local wallets enabled on
 * the merchant account.
 *
 * API reference: https://api.thewayl.com/reference (OpenAPI v1.0.0).
 */

export const WAYL_MIN_AMOUNT = 1000;
const MIN_REFUND_REASON = 100;
const MAX_REFUND_REASON = 1500;
const MIN_LINE_ITEM_LABEL = 3;
const MAX_LINK_MINUTES = 30 * 24 * 60;
const REQUEST_TIMEOUT_MS = 15_000;
const SIGNATURE_HEADER = "x-wayl-signature-256";
const HEX = /^[0-9a-f]+$/i;

export interface WaylOptions {
  /** Merchant token (X-WAYL-AUTHENTICATION). Keep it server-side. */
  apiKey: string;
  /** Defaults to https://api.thewayl.com. */
  baseUrl?: string;
  /** "test" for integration testing, "live" for real charges. */
  environment?: "live" | "test";
  /** For tests. */
  fetch?: typeof fetch;
  /** Secret Wayl uses to sign webhooks (10–255 characters). */
  webhookSecret: string;
}

interface WaylLink {
  completedAt?: string | null;
  currency?: string;
  id: string;
  paymentMethod?: string | null;
  referenceId: string;
  status: string;
  total: string | number;
  url?: string;
}

interface WaylRefund {
  amount: number;
  id: string;
  referenceId: string;
  status: string;
}

const linkStatuses: Record<string, CheckoutStatus> = {
  Cancelled: "canceled",
  Complete: "paid",
  Created: "pending",
  Delivered: "paid",
  Pending: "pending",
  Processing: "processing",
  Rejected: "failed",
  Returned: "refunded",
};

const refundStatuses: Record<string, Refund["status"]> = {
  Cancelled: "canceled",
  Refunded: "refunded",
  Rejected: "rejected",
  Requested: "requested",
};

/** Maps Wayl's link status to ours; unknown statuses stay pending. */
export const toCheckoutStatus = (status: string): CheckoutStatus =>
  linkStatuses[status] ?? "pending";

/** HMAC-SHA256 of the raw body, hex encoded, compared in constant time. */
export const verifyWaylSignature = (
  rawBody: string,
  signature: string | null,
  secret: string
) => {
  if (!(signature && HEX.test(signature))) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};

const toCheckout = (link: WaylLink): Checkout => {
  const status = toCheckoutStatus(link.status);

  return {
    amount: { amount: Number(link.total), currency: link.currency ?? "IQD" },
    completedAt: link.completedAt ?? null,
    paymentMethod: link.paymentMethod ?? null,
    providerReference: link.id,
    raw: link,
    referenceId: link.referenceId,
    status,
    url: status === "pending" ? (link.url ?? null) : null,
  };
};

const validateCheckout = ({
  amount,
  expiresInMinutes,
  lineItems,
}: CheckoutInput) => {
  if (amount.currency !== "IQD") {
    throw new PaymentProviderError("Wayl only supports IQD.");
  }
  if (!Number.isInteger(amount.amount) || amount.amount < WAYL_MIN_AMOUNT) {
    throw new PaymentProviderError(
      `Wayl requires a whole amount of at least ${WAYL_MIN_AMOUNT} IQD.`
    );
  }
  if (lineItems) {
    const net = lineItems.reduce(
      (sum, item) =>
        item.type === "decrease" ? sum - item.amount : sum + item.amount,
      0
    );
    if (net !== amount.amount) {
      throw new PaymentProviderError("Line items must add up to the total.");
    }
  }
  if (
    expiresInMinutes !== undefined &&
    !(expiresInMinutes >= 1 && expiresInMinutes <= MAX_LINK_MINUTES)
  ) {
    throw new PaymentProviderError(
      "Links can expire after 1 minute to 30 days."
    );
  }
};

const padLabel = (label: string) =>
  label.length >= MIN_LINE_ITEM_LABEL
    ? label
    : label.padEnd(MIN_LINE_ITEM_LABEL, ".");

export const createWaylProvider = ({
  apiKey,
  baseUrl = "https://api.thewayl.com",
  environment = "live",
  fetch: fetchImpl = fetch,
  webhookSecret,
}: WaylOptions): PaymentProvider => {
  const request = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetchImpl(`${baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-WAYL-AUTHENTICATION": apiKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: T;
      message?: string;
    };

    if (!(response.ok && body.data)) {
      throw new PaymentProviderError(
        `Wayl ${init.method ?? "GET"} ${path} failed: ${body.message ?? response.statusText}`,
        response.status
      );
    }

    return body.data;
  };

  const linkPath = (referenceId: string) =>
    `/links/${encodeURIComponent(referenceId)}`;

  return {
    async cancelCheckout(referenceId) {
      // Only invalidates links that haven't been paid.
      await request(`${linkPath(referenceId)}/invalidate-if-pending`, {
        method: "POST",
      });
    },

    capabilities: {
      methods: ["card", "qi-card", "zaincash", "fib"],
      recurring: false,
      refunds: true,
    },

    async createCheckout(input) {
      validateCheckout(input);

      const lineItems = input.lineItems ?? [
        { amount: input.amount.amount, label: "Order", type: "increase" },
      ];
      const link = await request<WaylLink>("/links", {
        body: JSON.stringify({
          currency: "IQD",
          env: environment,
          lineItem: lineItems.map((item) => ({
            amount: item.amount,
            label: padLabel(item.label),
            type: item.type ?? "increase",
          })),
          linkExpiresIn: input.expiresInMinutes
            ? `${input.expiresInMinutes}m`
            : undefined,
          redirectionUrl: input.redirectUrl,
          referenceId: input.referenceId,
          total: input.amount.amount,
          webhookSecret: input.webhookUrl ? webhookSecret : undefined,
          webhookUrl: input.webhookUrl,
        }),
        method: "POST",
      });

      return toCheckout(link);
    },

    async getCheckout(referenceId) {
      return toCheckout(await request<WaylLink>(linkPath(referenceId)));
    },

    id: "wayl",

    parseWebhook({ headers, rawBody }) {
      if (
        !verifyWaylSignature(
          rawBody,
          headers.get(SIGNATURE_HEADER),
          webhookSecret
        )
      ) {
        return Promise.reject(new WebhookVerificationError());
      }

      const payload = JSON.parse(rawBody) as { referenceId?: unknown };

      if (typeof payload.referenceId !== "string") {
        return Promise.reject(
          new WebhookVerificationError("Webhook has no referenceId")
        );
      }

      const event: PaymentEvent = {
        // Identical retries hash identically; distinct updates differ.
        eventKey: createHash("sha256").update(rawBody).digest("hex"),
        provider: "wayl",
        raw: payload,
        referenceId: payload.referenceId,
      };

      return Promise.resolve(event);
    },

    async refund({ amount, reason, referenceId }) {
      if (amount.currency !== "IQD" || amount.amount < WAYL_MIN_AMOUNT) {
        throw new PaymentProviderError(
          `Wayl refunds must be at least ${WAYL_MIN_AMOUNT} IQD.`
        );
      }
      if (
        reason.length < MIN_REFUND_REASON ||
        reason.length > MAX_REFUND_REASON
      ) {
        throw new PaymentProviderError(
          `Wayl requires a refund reason of ${MIN_REFUND_REASON}–${MAX_REFUND_REASON} characters.`
        );
      }

      const refund = await request<WaylRefund>("/refunds", {
        body: JSON.stringify({ amount: amount.amount, reason, referenceId }),
        method: "POST",
      });

      return {
        amount: { amount: refund.amount, currency: "IQD" },
        id: refund.id,
        raw: refund,
        referenceId: refund.referenceId,
        status: refundStatuses[refund.status] ?? "requested",
      };
    },
  };
};

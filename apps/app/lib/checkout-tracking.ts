import { track } from "@repo/analytics/client";

const STORAGE_KEY = "billing:pending-checkout";

export interface PendingCheckout {
  currency: string;
  planId: string;
  planName: string;
  referenceId: string;
  value: number;
}

interface PaymentState {
  reference_id: string | null;
  status: string;
}

const read = (): PendingCheckout | undefined => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PendingCheckout) : undefined;
  } catch {
    // Storage unavailable or unreadable: nothing to report.
  }
};

const forget = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode); nothing to clear.
  }
};

/** Keeps the checkout the visitor is about to leave for (hosted payment page). */
export const rememberCheckout = (checkout: PendingCheckout) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkout));
  } catch {
    // Storage unavailable: the purchase is still reported server-side.
  }
};

/**
 * Reports `purchase` once the remembered checkout shows up as paid. The event
 * id is derived from the payment's reference, the same id apps/api sends to
 * the Meta and TikTok conversion APIs, so the platforms count it once.
 * Returns true when a purchase was reported.
 */
export const reportCompletedCheckout = (payments: readonly PaymentState[]) => {
  const pending = read();
  const payment =
    pending &&
    payments.find(
      (candidate) => candidate.reference_id === pending.referenceId
    );

  // Not listed yet, or the webhook hasn't confirmed it: check again later.
  if (!(pending && payment) || payment.status === "pending") {
    return false;
  }

  forget();
  if (payment.status !== "paid") {
    return false;
  }

  track("purchase", {
    currency: pending.currency,
    items: [
      {
        id: pending.planId,
        name: pending.planName,
        price: pending.value,
        quantity: 1,
      },
    ],
    transactionId: pending.referenceId,
    value: pending.value,
  });
  return true;
};

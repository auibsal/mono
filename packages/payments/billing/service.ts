import { randomUUID } from "node:crypto";
import type { PaymentStatus } from "@repo/database";
import type { Checkout, CheckoutStatus, PaymentProvider } from "../types";
import type {
  BillingRepository,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from "./repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINK_MINUTES = 30 * 24 * 60;

const paymentStatusFor: Record<CheckoutStatus, PaymentStatus> = {
  canceled: "canceled",
  expired: "expired",
  failed: "failed",
  paid: "paid",
  pending: "pending",
  processing: "pending",
  refunded: "refunded",
};

const allowedTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  canceled: [],
  expired: [],
  failed: [],
  paid: ["refunded"],
  pending: ["paid", "failed", "canceled", "expired"],
  refunded: [],
};

export const canTransition = (from: PaymentStatus, to: PaymentStatus) =>
  allowedTransitions[from].includes(to);

/** The status to record, refusing payments for a different amount. */
const resolveStatus = (payment: PaymentRecord, checkout: Checkout) => {
  const next = paymentStatusFor[checkout.status];
  const amountMatches =
    checkout.amount.amount === payment.amount &&
    checkout.amount.currency === payment.currency;

  return next === "paid" && !amountMatches ? "failed" : next;
};

/** Adds one billing interval in UTC, clamping to the end of shorter months. */
export const addInterval = (
  date: Date,
  interval: PlanRecord["billingInterval"]
) => {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  if (interval === "year") {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
  } else {
    result.setUTCMonth(result.getUTCMonth() + 1);
  }
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
};

export type WebhookOutcome =
  | { status: "duplicate" }
  | { status: "ignored"; reason: "unknown-payment" }
  | {
      from: PaymentStatus;
      payment: PaymentRecord;
      status: "processed";
      to: PaymentStatus;
    };

export interface RenewalInvoice {
  amount: number;
  currency: string;
  organizationId: string;
  referenceId: string;
  subscriptionId: string;
  url: string | null;
}

interface BillingServiceOptions {
  /** Clock, for tests. */
  now?: () => Date;
  provider: PaymentProvider;
  repository: BillingRepository;
  /** Public URL of the payment webhook (apps/api/webhooks/payments). */
  webhookUrl?: string;
}

/**
 * Billing workflows on top of a payment provider. Subscriptions are
 * invoice-based: each period is paid through a new checkout link, because
 * Iraqi wallets generally can't be charged automatically.
 */
export const createBillingService = ({
  now = () => new Date(),
  provider,
  repository,
  webhookUrl,
}: BillingServiceOptions) => {
  const createInvoice = async ({
    description,
    expiresInMinutes,
    metadata,
    organizationId,
    plan,
    redirectUrl,
    subscriptionId,
    userId,
  }: {
    description: string;
    expiresInMinutes?: number;
    metadata?: Record<string, unknown>;
    organizationId: string;
    plan: PlanRecord;
    redirectUrl?: string;
    subscriptionId: string | null;
    userId: string | null;
  }) => {
    const referenceId = `pay_${randomUUID()}`;
    await repository.createPayment({
      amount: plan.amount,
      currency: plan.currency,
      description,
      metadata,
      organizationId,
      provider: provider.id,
      referenceId,
      subscriptionId,
      userId,
    });

    try {
      const checkout = await provider.createCheckout({
        amount: { amount: plan.amount, currency: plan.currency },
        expiresInMinutes,
        lineItems: [{ amount: plan.amount, label: description }],
        redirectUrl,
        referenceId,
        webhookUrl,
      });
      await repository.updatePayment(referenceId, {
        checkoutUrl: checkout.url,
        providerPaymentId: checkout.providerReference,
      });

      return { referenceId, url: checkout.url };
    } catch (error) {
      await repository.updatePayment(referenceId, { status: "failed" });
      throw error;
    }
  };

  const activateSubscription = async (subscription: SubscriptionRecord) => {
    const plan = await repository.getPlan(subscription.planId);
    if (!plan) {
      throw new Error(`Plan ${subscription.planId} not found`);
    }

    // Renewals paid early extend from the end of the current period.
    const current = now();
    const periodEnd = subscription.currentPeriodEnd;
    const base = periodEnd && periodEnd > current ? periodEnd : current;

    await repository.updateSubscription(subscription.id, {
      currentPeriodEnd: addInterval(base, plan.billingInterval),
      currentPeriodStart: base,
      status: "active",
    });
  };

  const applyStatus = async (
    payment: PaymentRecord,
    next: PaymentStatus,
    checkout: Checkout
  ) => {
    await repository.updatePayment(payment.referenceId, {
      ...(next === "paid"
        ? { paidAt: now(), paymentMethod: checkout.paymentMethod }
        : {}),
      checkoutUrl: null,
      status: next,
    });

    if (next !== "paid" || !payment.subscriptionId) {
      return;
    }

    const subscription = await repository.getSubscription(
      payment.subscriptionId
    );
    if (subscription) {
      await activateSubscription(subscription);
    }
  };

  type RenewalResult =
    | { kind: "expired" }
    | { kind: "skipped"; pastDue: boolean }
    | { invoice: RenewalInvoice; kind: "invoiced"; pastDue: boolean };

  const renewSubscription = async (
    subscription: SubscriptionRecord,
    current: Date,
    { graceDays, leadDays }: { graceDays: number; leadDays: number }
  ): Promise<RenewalResult> => {
    const end = subscription.currentPeriodEnd ?? current;

    if (end.getTime() + graceDays * DAY_MS < current.getTime()) {
      await repository.updateSubscription(subscription.id, {
        status: subscription.cancelAtPeriodEnd ? "canceled" : "expired",
      });
      return { kind: "expired" };
    }

    if (subscription.cancelAtPeriodEnd) {
      return { kind: "skipped", pastDue: false };
    }

    const pastDue = end < current && subscription.status === "active";
    if (pastDue) {
      await repository.updateSubscription(subscription.id, {
        status: "past_due",
      });
    }

    const [hasPending, plan] = await Promise.all([
      repository.hasPendingPayment(subscription.id),
      repository.getPlan(subscription.planId),
    ]);
    if (hasPending || !plan?.active) {
      return { kind: "skipped", pastDue };
    }

    const { referenceId, url } = await createInvoice({
      description: plan.name,
      expiresInMinutes: Math.min(
        MAX_LINK_MINUTES,
        (leadDays + graceDays) * 24 * 60
      ),
      organizationId: subscription.organizationId,
      plan,
      subscriptionId: subscription.id,
      userId: null,
    });

    return {
      invoice: {
        amount: plan.amount,
        currency: plan.currency,
        organizationId: subscription.organizationId,
        referenceId,
        subscriptionId: subscription.id,
        url,
      },
      kind: "invoiced",
      pastDue,
    };
  };

  return {
    /**
     * Verifies and records a provider webhook, then applies the payment's
     * authoritative status as read back from the provider's API.
     */
    async handleWebhook(request: { headers: Headers; rawBody: string }) {
      const event = await provider.parseWebhook(request);
      const eventId = await repository.recordWebhookEvent({
        eventKey: event.eventKey,
        payload: event.raw,
        provider: event.provider,
        referenceId: event.referenceId,
      });

      if (eventId === null) {
        return { status: "duplicate" } satisfies WebhookOutcome;
      }

      const payment = await repository.getPaymentByReference(event.referenceId);
      if (!payment) {
        await repository.markWebhookProcessed(eventId);
        return {
          reason: "unknown-payment",
          status: "ignored",
        } satisfies WebhookOutcome;
      }

      const checkout = await provider.getCheckout(event.referenceId);
      const next = resolveStatus(payment, checkout);
      const transitions = canTransition(payment.status, next);

      if (transitions) {
        await applyStatus(payment, next, checkout);
      }

      await repository.markWebhookProcessed(eventId);

      return {
        from: payment.status,
        payment,
        status: "processed",
        to: transitions ? next : payment.status,
      } satisfies WebhookOutcome;
    },

    /**
     * Daily job: marks overdue subscriptions past due, expires them after the
     * grace period and issues a renewal invoice before each period ends.
     */
    async issueRenewals({
      graceDays = 7,
      leadDays = 3,
    }: {
      graceDays?: number;
      leadDays?: number;
    } = {}) {
      const current = now();
      const due = await repository.findSubscriptionsDueBefore(
        new Date(current.getTime() + leadDays * DAY_MS)
      );
      const invoices: RenewalInvoice[] = [];
      let expired = 0;
      let pastDue = 0;

      for (const subscription of due) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential to respect provider rate limits
        const result = await renewSubscription(subscription, current, {
          graceDays,
          leadDays,
        });

        if (result.kind === "expired") {
          expired += 1;
          continue;
        }
        if (result.pastDue) {
          pastDue += 1;
        }
        if (result.kind === "invoiced") {
          invoices.push(result.invoice);
        }
      }

      return { expired, invoices, pastDue };
    },
    /** Starts paying for a plan; returns the hosted checkout URL. */
    async startCheckout({
      metadata,
      organizationId,
      planId,
      redirectUrl,
      userId,
    }: {
      /** Stored with the payment (e.g. attribution for ad conversions). */
      metadata?: Record<string, unknown>;
      organizationId: string;
      planId: string;
      redirectUrl?: string;
      userId: string;
    }) {
      const plan = await repository.getPlan(planId);
      if (!plan?.active) {
        throw new Error(`Plan ${planId} is not available`);
      }

      let subscription = await repository.getLiveSubscription(organizationId);
      if (!subscription) {
        subscription = await repository.createSubscription({
          organizationId,
          planId,
          provider: provider.id,
        });
      } else if (subscription.planId !== planId) {
        await repository.updateSubscription(subscription.id, { planId });
      }

      return createInvoice({
        description: plan.name,
        metadata,
        organizationId,
        plan,
        redirectUrl,
        subscriptionId: subscription.id,
        userId,
      });
    },
  };
};

export type BillingService = ReturnType<typeof createBillingService>;

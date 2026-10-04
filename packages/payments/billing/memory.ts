import { randomUUID } from "node:crypto";
import type {
  BillingRepository,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from "./repository";

/** In-memory BillingRepository for tests. */
export const createMemoryBillingRepository = (plans: PlanRecord[] = []) => {
  const state = {
    payments: new Map<
      string,
      PaymentRecord & { checkoutUrl?: string | null }
    >(),
    plans: new Map(plans.map((plan) => [plan.id, plan])),
    subscriptions: new Map<string, SubscriptionRecord>(),
    webhookEvents: new Map<string, { id: number; processed: boolean }>(),
  };

  const repository: BillingRepository = {
    createPayment(payment) {
      const record: PaymentRecord = {
        amount: payment.amount,
        currency: payment.currency,
        id: randomUUID(),
        metadata: payment.metadata ?? {},
        organizationId: payment.organizationId,
        provider: payment.provider,
        referenceId: payment.referenceId,
        status: "pending",
        subscriptionId: payment.subscriptionId,
        userId: payment.userId,
      };
      state.payments.set(record.referenceId, record);
      return Promise.resolve(record);
    },
    createSubscription({ organizationId, planId }) {
      const record: SubscriptionRecord = {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        currentPeriodStart: null,
        id: randomUUID(),
        organizationId,
        planId,
        status: "incomplete",
      };
      state.subscriptions.set(record.id, record);
      return Promise.resolve(record);
    },
    findSubscriptionsDueBefore(date) {
      return Promise.resolve(
        [...state.subscriptions.values()].filter(
          (subscription) =>
            ["active", "past_due"].includes(subscription.status) &&
            subscription.currentPeriodEnd !== null &&
            subscription.currentPeriodEnd <= date
        )
      );
    },
    getLiveSubscription(organizationId) {
      return Promise.resolve(
        [...state.subscriptions.values()].find(
          (subscription) =>
            subscription.organizationId === organizationId &&
            ["incomplete", "active", "past_due"].includes(subscription.status)
        ) ?? null
      );
    },
    getPaymentByReference(referenceId) {
      return Promise.resolve(state.payments.get(referenceId) ?? null);
    },
    getPlan(planId) {
      return Promise.resolve(state.plans.get(planId) ?? null);
    },
    getSubscription(id) {
      return Promise.resolve(state.subscriptions.get(id) ?? null);
    },
    hasPendingPayment(subscriptionId) {
      return Promise.resolve(
        [...state.payments.values()].some(
          (payment) =>
            payment.subscriptionId === subscriptionId &&
            payment.status === "pending"
        )
      );
    },
    markWebhookProcessed(eventId) {
      for (const event of state.webhookEvents.values()) {
        if (event.id === eventId) {
          event.processed = true;
        }
      }
      return Promise.resolve();
    },
    recordWebhookEvent({ eventKey, provider }) {
      const key = `${provider}:${eventKey}`;
      if (state.webhookEvents.has(key)) {
        return Promise.resolve(null);
      }
      const id = state.webhookEvents.size + 1;
      state.webhookEvents.set(key, { id, processed: false });
      return Promise.resolve(id);
    },
    updatePayment(referenceId, update) {
      const payment = state.payments.get(referenceId);
      if (payment) {
        state.payments.set(referenceId, {
          ...payment,
          ...(update.status ? { status: update.status } : {}),
          checkoutUrl: update.checkoutUrl ?? payment.checkoutUrl,
        });
      }
      return Promise.resolve();
    },
    updateSubscription(id, update) {
      const subscription = state.subscriptions.get(id);
      if (subscription) {
        state.subscriptions.set(id, {
          ...subscription,
          ...Object.fromEntries(
            Object.entries(update).filter(([, value]) => value !== undefined)
          ),
        });
      }
      return Promise.resolve();
    },
  };

  return { repository, state };
};

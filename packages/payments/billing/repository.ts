import type { PaymentStatus, SubscriptionStatus } from "@repo/database";

export interface PlanRecord {
  active: boolean;
  amount: number;
  billingInterval: "month" | "year";
  currency: string;
  id: string;
  name: string;
}

export interface SubscriptionRecord {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date | null;
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
}

export interface PaymentRecord {
  amount: number;
  currency: string;
  id: string;
  /** Free-form data kept with the payment, e.g. ad attribution. */
  metadata: Record<string, unknown>;
  organizationId: string | null;
  provider: string;
  referenceId: string;
  status: PaymentStatus;
  subscriptionId: string | null;
  userId: string | null;
}

export interface NewPayment {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, unknown>;
  organizationId: string;
  provider: string;
  referenceId: string;
  subscriptionId: string | null;
  userId: string | null;
}

export interface PaymentUpdate {
  checkoutUrl?: string | null;
  paidAt?: Date;
  paymentMethod?: string | null;
  providerPaymentId?: string;
  status?: PaymentStatus;
}

export interface SubscriptionUpdate {
  currentPeriodEnd?: Date;
  currentPeriodStart?: Date;
  planId?: string;
  status?: SubscriptionStatus;
}

/**
 * Persistence used by the billing service. The Supabase implementation runs
 * with the secret key; tests use an in-memory one.
 */
export interface BillingRepository {
  createPayment: (payment: NewPayment) => Promise<PaymentRecord>;
  createSubscription: (input: {
    organizationId: string;
    planId: string;
    provider: string;
  }) => Promise<SubscriptionRecord>;
  /** Active or past-due subscriptions whose period ends before `date`. */
  findSubscriptionsDueBefore: (date: Date) => Promise<SubscriptionRecord[]>;
  getLiveSubscription: (
    organizationId: string
  ) => Promise<SubscriptionRecord | null>;
  getPaymentByReference: (referenceId: string) => Promise<PaymentRecord | null>;
  getPlan: (planId: string) => Promise<PlanRecord | null>;
  getSubscription: (id: string) => Promise<SubscriptionRecord | null>;
  /** True when the subscription already has an unpaid invoice. */
  hasPendingPayment: (subscriptionId: string) => Promise<boolean>;
  markWebhookProcessed: (eventId: number) => Promise<void>;
  /** Stores a webhook delivery; returns null if it was already recorded. */
  recordWebhookEvent: (event: {
    eventKey: string;
    payload: unknown;
    provider: string;
    referenceId: string;
  }) => Promise<number | null>;
  updatePayment: (referenceId: string, update: PaymentUpdate) => Promise<void>;
  updateSubscription: (id: string, update: SubscriptionUpdate) => Promise<void>;
}

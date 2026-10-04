import "server-only";

import { getConversions, readAttribution } from "@repo/analytics/conversions";
import { analytics } from "@repo/analytics/server";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import type { PaymentRecord } from "@repo/payments/server";

const lookupUser = async (userId: string) => {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return {
    email: data.user?.email,
    externalId: userId,
    phone: data.user?.phone,
  };
};

/**
 * Reports a completed payment to product analytics and, for checkouts that
 * started in a browser, to the Meta and TikTok conversion APIs. The event id
 * matches `track("purchase", { transactionId })` in the browser, so a
 * purchase reported from both sides is counted once.
 */
export const reportPayment = async (payment: PaymentRecord) => {
  analytics?.capture({
    distinctId: payment.userId ?? payment.organizationId ?? payment.referenceId,
    event: "Payment Completed",
    properties: {
      amount: payment.amount,
      currency: payment.currency,
      organizationId: payment.organizationId,
      referenceId: payment.referenceId,
    },
  });

  const conversions = getConversions();
  const attribution = readAttribution(payment.metadata);

  // Renewals and native-app checkouts carry no browser context; they are not
  // ad conversions.
  if (conversions.enabled && attribution) {
    const results = await conversions.track(
      "purchase",
      {
        currency: payment.currency,
        transactionId: payment.referenceId,
        value: payment.amount,
      },
      {
        attribution,
        user: payment.userId ? await lookupUser(payment.userId) : undefined,
      }
    );

    for (const result of results) {
      if (!result.ok) {
        log.warn(
          `Conversion not sent to ${result.destination}: ${parseError(result.error)}`
        );
      }
    }
  }

  await analytics?.shutdown();
};

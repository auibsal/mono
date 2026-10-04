import "server-only";

import { createAdminClient } from "@repo/database/admin";
import { sendEmail } from "@repo/email";
import { log } from "@repo/observability/log";
import type { RenewalInvoice } from "@repo/payments/server";

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IQ", { currency, style: "currency" }).format(
    amount
  );

/**
 * Emails each renewal invoice to the organization's owners and admins.
 * Members without an email (phone-only accounts) are skipped and logged;
 * hook an SMS/WhatsApp notification in here if that matters for the product.
 */
export const notifyRenewalInvoices = async (invoices: RenewalInvoice[]) => {
  const admin = createAdminClient();

  for (const invoice of invoices) {
    if (!invoice.url) {
      continue;
    }

    // biome-ignore lint/performance/noAwaitInLoops: invoices are few and sent in order
    const { data: managers } = await admin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", invoice.organizationId)
      .in("role", ["owner", "admin"]);

    const users = await Promise.all(
      (managers ?? []).map(({ user_id }) =>
        admin.auth.admin.getUserById(user_id)
      )
    );

    for (const { data } of users) {
      const email = data.user?.email;

      if (!email) {
        log.info("Renewal invoice not emailed (no email address)", {
          referenceId: invoice.referenceId,
          userId: data.user?.id,
        });
        continue;
      }

      // biome-ignore lint/performance/noAwaitInLoops: a handful of recipients per invoice
      await sendEmail({
        subject: "Your subscription renewal is due",
        text: `Your subscription renews soon. Pay ${formatAmount(invoice.amount, invoice.currency)} here: ${invoice.url}`,
        to: email,
      });
    }
  }
};

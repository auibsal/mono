import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { getBilling } from "@repo/payments/server";
import { NextResponse } from "next/server";
import { notifyRenewalInvoices } from "@/lib/billing-notifications";
import { isAuthorizedCronRequest, unauthorized } from "@/lib/cron";

/**
 * Daily: issues renewal invoices a few days before each period ends, marks
 * unpaid subscriptions past due and expires them after the grace period.
 */
export const GET = async (request: Request): Promise<Response> => {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorized();
  }

  try {
    const { expired, invoices, pastDue } = await getBilling().issueRenewals();
    await notifyRenewalInvoices(invoices);

    return NextResponse.json({
      expired,
      invoiced: invoices.length,
      ok: true,
      pastDue,
    });
  } catch (error) {
    log.error(`Subscription renewals failed: ${parseError(error)}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
};

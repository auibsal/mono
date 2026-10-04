import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { WebhookVerificationError } from "@repo/payments";
import { getBilling } from "@repo/payments/server";
import { after, NextResponse } from "next/server";
import { reportPayment } from "@/lib/conversions";

/**
 * Payment provider webhooks. The billing service verifies the signature over
 * the raw body, ignores repeated deliveries and re-reads the payment from the
 * provider's API before changing any state.
 */
export const POST = async (request: Request): Promise<Response> => {
  const rawBody = await request.text();

  try {
    const outcome = await getBilling().handleWebhook({
      headers: request.headers,
      rawBody,
    });

    if (outcome.status === "processed" && outcome.to === "paid") {
      const { payment } = outcome;
      // After the response, so analytics never delays or fails the webhook.
      after(() =>
        reportPayment(payment).catch((error: unknown) =>
          log.error(`Payment reporting failed: ${parseError(error)}`)
        )
      );
    }

    return NextResponse.json({ ok: true, status: outcome.status });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json(
        { message: error.message, ok: false },
        { status: 401 }
      );
    }

    log.error(`Payment webhook failed: ${parseError(error)}`);
    // A 5xx makes the provider retry the delivery later.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
};

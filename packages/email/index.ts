import type { ReactElement } from "react";
import { Resend } from "resend";
import { keys } from "./keys";

const { RESEND_FROM, RESEND_TOKEN } = keys();

export const resend = RESEND_TOKEN ? new Resend(RESEND_TOKEN) : undefined;

type EmailContent =
  | { react: ReactElement; text?: string }
  | { react?: ReactElement; text: string };

type SendEmailOptions = EmailContent & {
  /** Resend drops a repeat of the same key for 24 hours (safe retries). */
  idempotencyKey?: string;
  replyTo?: string;
  subject: string;
  to: string | string[];
};

/**
 * The plan's daily or monthly sending limit is spent (the free plan allows
 * 100 a day). Nothing is wrong with the email; send it again after the
 * limit resets.
 */
export class EmailQuotaError extends Error {
  override name = "EmailQuotaError";
}

const QUOTA_ERRORS = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

/** Sends a transactional email from `RESEND_FROM`. Throws on failure. */
export const sendEmail = async ({
  to,
  subject,
  replyTo,
  idempotencyKey,
  ...content
}: SendEmailOptions) => {
  if (!(resend && RESEND_FROM)) {
    throw new Error(
      "Email is not configured: set RESEND_TOKEN and RESEND_FROM."
    );
  }

  const { data, error } = await resend.emails.send(
    {
      from: RESEND_FROM,
      replyTo,
      subject,
      to,
      ...(content.react
        ? { react: content.react, text: content.text }
        : { text: content.text as string }),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw QUOTA_ERRORS.has(error.name)
      ? new EmailQuotaError(error.message)
      : new Error(error.message);
  }

  return data;
};

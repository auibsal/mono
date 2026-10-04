import type { ReactElement } from "react";
import { Resend } from "resend";
import { keys } from "./keys";

const { RESEND_FROM, RESEND_TOKEN } = keys();

export const resend = RESEND_TOKEN ? new Resend(RESEND_TOKEN) : undefined;

type EmailContent =
  | { react: ReactElement; text?: string }
  | { react?: ReactElement; text: string };

type SendEmailOptions = EmailContent & {
  replyTo?: string;
  subject: string;
  to: string | string[];
};

/** Sends a transactional email from `RESEND_FROM`. Throws on failure. */
export const sendEmail = async ({
  to,
  subject,
  replyTo,
  ...content
}: SendEmailOptions) => {
  if (!(resend && RESEND_FROM)) {
    throw new Error(
      "Email is not configured: set RESEND_TOKEN and RESEND_FROM."
    );
  }

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    replyTo,
    subject,
    to,
    ...(content.react
      ? { react: content.react, text: content.text }
      : { text: content.text as string }),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

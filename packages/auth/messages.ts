import type { OtpErrorCode } from "./otp";

/**
 * Texts used by the auth components. English defaults live here; apps pass
 * translated messages (see the `auth` namespace in @repo/internationalization).
 */
export interface AuthMessages {
  changePhone: string;
  codeLabel: string;
  codeSentTo: string;
  continue: string;
  createOrganization: string;
  errors: Record<OtpErrorCode, string>;
  fullNameLabel: string;
  organizations: string;
  phoneHint: string;
  phoneLabel: string;
  resend: string;
  resendIn: string;
  sending: string;
  signOut: string;
  verify: string;
  verifying: string;
}

export const defaultAuthMessages: AuthMessages = {
  changePhone: "Use a different number",
  codeLabel: "Verification code",
  codeSentTo: "We sent a 6-digit code to {phone}.",
  continue: "Continue",
  createOrganization: "Create organization",
  errors: {
    captcha_failed: "Please complete the security check and try again.",
    delivery_failed: "We couldn't send the code. Please try again shortly.",
    invalid_code: "That code is incorrect or has expired.",
    invalid_phone: "Enter a valid mobile number, e.g. 0770 123 4567.",
    rate_limited: "Too many attempts. Please wait a moment and try again.",
    signups_disabled: "New sign-ups are currently closed.",
    unknown: "Something went wrong. Please try again.",
  },
  fullNameLabel: "Full name",
  organizations: "Organizations",
  phoneHint: "We'll text you a verification code.",
  phoneLabel: "Mobile number",
  resend: "Resend code",
  resendIn: "Resend code in {seconds}s",
  sending: "Sending…",
  signOut: "Sign out",
  verify: "Verify",
  verifying: "Verifying…",
};

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replaces `{name}` placeholders in a message. */
export const format = (
  message: string,
  values: Record<string, string | number>
) =>
  message.replace(PLACEHOLDER, (match, key: string) =>
    key in values ? String(values[key]) : match
  );

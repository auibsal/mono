import type { EmailAuthErrorCode } from "./email";

/**
 * Texts used by the auth components. English defaults live here; apps pass
 * translated messages (the `auth` namespace in @repo/internationalization).
 */
export interface AuthMessages {
  errors: Record<EmailAuthErrorCode, string>;
  signOut: string;
}

export const defaultAuthMessages: AuthMessages = {
  errors: {
    email_not_confirmed: "Confirm your email address first: check your inbox.",
    invalid_credentials: "That email and password don't match.",
    invalid_email: "Enter a valid email address.",
    rate_limited: "Too many attempts. Please wait a moment and try again.",
    signups_disabled: "New sign-ups are currently closed.",
    unknown: "Something went wrong. Please try again.",
    user_exists: "An account with this email already exists. Sign in instead.",
    weak_password: "Use at least 10 characters, with letters and numbers.",
  },
  signOut: "Sign out",
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

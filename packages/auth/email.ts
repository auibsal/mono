import type { Database } from "@repo/database";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

/** AUIB addresses are verified automatically once confirmed. */
export const AUIB_DOMAIN = "auib.edu.iq";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) =>
  EMAIL.test(normalizeEmail(email));

export const isAuibEmail = (email: string) =>
  normalizeEmail(email).split("@")[1] === AUIB_DOMAIN;

export const MIN_PASSWORD_LENGTH = 10;

export type EmailAuthErrorCode =
  | "email_not_confirmed"
  | "invalid_credentials"
  | "invalid_email"
  | "rate_limited"
  | "signups_disabled"
  | "unknown"
  | "user_exists"
  | "weak_password";

export type AuthResult<T = undefined> =
  | { ok: true; value: T }
  | { code: EmailAuthErrorCode; ok: false };

/** Maps a Supabase Auth error to a code the UI can translate. */
export const toEmailAuthError = (
  error: Pick<AuthError, "code" | "status"> | null | undefined
): EmailAuthErrorCode => {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "weak_password":
      return "weak_password";
    case "user_already_exists":
    case "email_exists":
      return "user_exists";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signups_disabled";
    case "email_address_invalid":
    case "validation_failed":
      return "invalid_email";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      return error?.status === 429 ? "rate_limited" : "unknown";
  }
};

type Client = SupabaseClient<Database>;

export interface SignUpDetails {
  email: string;
  fullNameAr?: string;
  fullNameEn: string;
  locale: "ar" | "en";
  password: string;
  /** Where the confirmation link lands (the Nexus /auth/callback). */
  redirectTo: string;
  /** For non-AUIB addresses: who the applicant is (alumni, guest…). */
  verificationStatement?: string;
}

/**
 * Creates an account. Metadata here only fills in the profile; it is never
 * used for authorization (roles live in access.role_assignments).
 */
export const signUpWithEmail = async (
  supabase: Client,
  details: SignUpDetails
): Promise<AuthResult<{ needsConfirmation: boolean }>> => {
  const email = normalizeEmail(details.email);

  if (!isValidEmail(email)) {
    return { code: "invalid_email", ok: false };
  }
  if (details.password.length < MIN_PASSWORD_LENGTH) {
    return { code: "weak_password", ok: false };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    options: {
      data: {
        full_name_ar: details.fullNameAr?.trim() || undefined,
        full_name_en: details.fullNameEn.trim(),
        locale: details.locale,
        verification_statement: isAuibEmail(email)
          ? undefined
          : details.verificationStatement?.trim() || undefined,
      },
      emailRedirectTo: details.redirectTo,
    },
    password: details.password,
  });

  if (error) {
    return { code: toEmailAuthError(error), ok: false };
  }

  return { ok: true, value: { needsConfirmation: !data.session } };
};

export const signInWithPassword = async (
  supabase: Client,
  email: string,
  password: string
): Promise<AuthResult> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  return error
    ? { code: toEmailAuthError(error), ok: false }
    : { ok: true, value: undefined };
};

/** Magic link for existing accounts (it never creates one). */
export const sendMagicLink = async (
  supabase: Client,
  email: string,
  redirectTo: string
): Promise<AuthResult> => {
  if (!isValidEmail(email)) {
    return { code: "invalid_email", ok: false };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });

  // Don't reveal whether an account exists.
  if (error && toEmailAuthError(error) === "rate_limited") {
    return { code: "rate_limited", ok: false };
  }
  return { ok: true, value: undefined };
};

export const sendPasswordReset = async (
  supabase: Client,
  email: string,
  redirectTo: string
): Promise<AuthResult> => {
  if (!isValidEmail(email)) {
    return { code: "invalid_email", ok: false };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    { redirectTo }
  );

  if (error && toEmailAuthError(error) === "rate_limited") {
    return { code: "rate_limited", ok: false };
  }
  return { ok: true, value: undefined };
};

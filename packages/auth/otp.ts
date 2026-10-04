import type { Database } from "@repo/database";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "./phone";

export type OtpChannel = "sms" | "whatsapp";

export type OtpErrorCode =
  | "invalid_phone"
  | "rate_limited"
  | "invalid_code"
  | "captcha_failed"
  | "signups_disabled"
  | "delivery_failed"
  | "unknown";

export type OtpResult<T = undefined> =
  | { ok: true; phone: string; value: T }
  | { code: OtpErrorCode; message: string; ok: false };

// https://supabase.com/docs/guides/auth/debugging/error-codes
const errorCodes: Record<string, OtpErrorCode> = {
  captcha_failed: "captcha_failed",
  otp_disabled: "signups_disabled",
  otp_expired: "invalid_code",
  over_request_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",
  phone_provider_disabled: "delivery_failed",
  signup_disabled: "signups_disabled",
  sms_send_failed: "delivery_failed",
  validation_failed: "invalid_phone",
};

export const toOtpErrorCode = (error: Pick<AuthError, "code" | "status">) => {
  if (error.code && error.code in errorCodes) {
    return errorCodes[error.code] as OtpErrorCode;
  }
  return error.status === 429 ? "rate_limited" : "unknown";
};

const failure = (error: AuthError): OtpResult<never> => ({
  code: toOtpErrorCode(error),
  message: error.message,
  ok: false,
});

const invalidPhone: OtpResult<never> = {
  code: "invalid_phone",
  message: "Enter a valid phone number.",
  ok: false,
};

interface SendOtpOptions {
  captchaToken?: string;
  channel?: OtpChannel;
  /** Stored on new accounts only; becomes the profile's display name. */
  fullName?: string;
  locale?: string;
  /** Set to false to only allow existing users to sign in. */
  shouldCreateUser?: boolean;
}

/** Sends a one-time code to the phone number (SMS by default). */
export const sendPhoneOtp = async (
  supabase: SupabaseClient<Database>,
  rawPhone: string,
  {
    captchaToken,
    channel = "sms",
    fullName,
    locale,
    shouldCreateUser = true,
  }: SendOtpOptions = {}
): Promise<OtpResult> => {
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    return invalidPhone;
  }

  const { error } = await supabase.auth.signInWithOtp({
    options: {
      captchaToken,
      channel,
      data: { full_name: fullName?.trim() || undefined, locale },
      shouldCreateUser,
    },
    phone,
  });

  return error ? failure(error) : { ok: true, phone, value: undefined };
};

/** Verifies the code; on success the client holds a signed-in session. */
export const verifyPhoneOtp = async (
  supabase: SupabaseClient<Database>,
  phone: string,
  token: string
): Promise<OtpResult<{ userId: string }>> => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    return failure(error);
  }

  if (!data.user) {
    return { code: "unknown", message: "Verification failed.", ok: false };
  }

  return { ok: true, phone, value: { userId: data.user.id } };
};

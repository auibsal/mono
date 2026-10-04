"use client";

import type { Database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/design-system/components/ui/input-otp";
import { Label } from "@repo/design-system/components/ui/label";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "../client";
import { type AuthMessages, defaultAuthMessages, format } from "../messages";
import {
  type OtpChannel,
  type OtpErrorCode,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../otp";
import { formatPhone } from "../phone";

const CODE_LENGTH = 6;
const RESEND_AFTER_SECONDS = 60;
const CODE_SLOTS = Array.from({ length: CODE_LENGTH }, (_, index) => index);

interface PhoneOtpFormProps {
  /** `whatsapp` requires a provider that supports it (e.g. Twilio Verify). */
  readonly channel?: OtpChannel;
  /** Ask for a display name (sign-up). */
  readonly collectName?: boolean;
  /** Returns a Turnstile/hCaptcha token when CAPTCHA protection is enabled. */
  readonly getCaptchaToken?: () => Promise<string | undefined>;
  /** Stored on new accounts as their preferred language. */
  readonly locale?: string;
  readonly messages?: AuthMessages;
  /** Called after sign-in instead of navigating to `redirectTo`. */
  readonly onSignedIn?: (userId: string) => void;
  readonly redirectTo?: string;
  /** Defaults to the browser client; pass the native client in Capacitor. */
  readonly supabase?: SupabaseClient<Database>;
}

const getSubmitLabel = (
  step: "phone" | "code",
  pending: boolean,
  messages: AuthMessages
) => {
  if (step === "phone") {
    return pending ? messages.sending : messages.continue;
  }
  return pending ? messages.verifying : messages.verify;
};

/**
 * Passwordless sign-in and sign-up with a one-time code sent to a mobile
 * number. Numbers may be typed in local (07…) or international format and in
 * Arabic-Indic digits.
 */
export const PhoneOtpForm = ({
  channel = "sms",
  collectName = false,
  getCaptchaToken,
  locale,
  messages = defaultAuthMessages,
  onSignedIn,
  redirectTo = "/",
  supabase: providedClient,
}: PhoneOtpFormProps) => {
  const id = useId();
  const router = useRouter();
  const supabase = useMemo(
    () => providedClient ?? createClient(),
    [providedClient]
  );
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [fullName, setFullName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<OtpErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    setPending(true);
    setError(null);

    const result = await sendPhoneOtp(supabase, phoneInput, {
      captchaToken: await getCaptchaToken?.(),
      channel,
      fullName: collectName ? fullName : undefined,
      locale,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.code);
      return;
    }

    setPhone(result.phone);
    setCode("");
    setStep("code");
    setResendIn(RESEND_AFTER_SECONDS);
  };

  const verifyCode = async (token: string) => {
    setPending(true);
    setError(null);

    const result = await verifyPhoneOtp(supabase, phone, token);

    if (!result.ok) {
      setPending(false);
      setError(result.code);
      setCode("");
      return;
    }

    if (onSignedIn) {
      onSignedIn(result.value.userId);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === "phone") {
      await sendCode();
    } else if (code.length === CODE_LENGTH) {
      await verifyCode(code);
    }
  };

  const errorMessage = error ? messages.errors[error] : null;

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      {step === "phone" ? (
        <>
          {collectName ? (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>{messages.fullNameLabel}</Label>
              <Input
                autoComplete="name"
                id={`${id}-name`}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-phone`}>{messages.phoneLabel}</Label>
            {/* Phone numbers read left-to-right in Arabic too. */}
            <Input
              aria-describedby={`${id}-phone-hint`}
              autoComplete="tel"
              className="text-start"
              dir="ltr"
              id={`${id}-phone`}
              inputMode="tel"
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder="0770 123 4567"
              required
              type="tel"
              value={phoneInput}
            />
            <p
              className="text-muted-foreground text-sm"
              id={`${id}-phone-hint`}
            >
              {messages.phoneHint}
            </p>
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-code`}>{messages.codeLabel}</Label>
          <p className="text-muted-foreground text-sm">
            {format(messages.codeSentTo, { phone: formatPhone(phone) })}
          </p>
          <div className="flex justify-center" dir="ltr">
            <InputOTP
              autoComplete="one-time-code"
              autoFocus
              disabled={pending}
              id={`${id}-code`}
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              onChange={setCode}
              onComplete={verifyCode}
              pattern="^[0-9]+$"
              value={code}
            >
              <InputOTPGroup>
                {CODE_SLOTS.map((slot) => (
                  <InputOTPSlot index={slot} key={slot} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={pending} type="submit">
        {getSubmitLabel(step, pending, messages)}
      </Button>

      {step === "code" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
            type="button"
            variant="link"
          >
            {messages.changePhone}
          </Button>
          <Button
            disabled={pending || resendIn > 0}
            onClick={sendCode}
            type="button"
            variant="link"
          >
            {resendIn > 0
              ? format(messages.resendIn, { seconds: resendIn })
              : messages.resend}
          </Button>
        </div>
      ) : null}
    </form>
  );
};

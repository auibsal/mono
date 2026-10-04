"use client";

import { identify, track } from "@repo/analytics/client";
import { PhoneOtpForm } from "@repo/auth/components/phone-otp-form";
import { useAuth } from "@repo/auth/provider";
import { Link } from "@repo/internationalization/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { takeAccountDeletedNotice } from "@/lib/account-deletion";
import { useAuthMessages } from "@/lib/auth-messages";
import { safeNextPath } from "@/lib/navigation";

interface PhoneSignInProps {
  readonly mode: "sign-in" | "sign-up";
}

/** Sign-in and sign-up with a one-time code sent by SMS. */
export const PhoneSignIn = ({ mode }: PhoneSignInProps) => {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { supabase } = useAuth();
  const messages = useAuthMessages();
  const next = safeNextPath(useSearchParams().get("next"));
  const isSignUp = mode === "sign-up";
  const [accountDeleted, setAccountDeleted] = useState(false);

  // After an effect, so the prerendered page hydrates without a mismatch.
  useEffect(() => setAccountDeleted(takeAccountDeletedNotice()), []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          {isSignUp ? t("signUp.title") : t("signIn.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isSignUp ? t("signUp.description") : t("signIn.description")}
        </p>
      </div>
      {accountDeleted ? (
        <p
          className="rounded-md bg-muted p-3 text-center text-sm"
          role="status"
        >
          {t("signIn.deleted")}
        </p>
      ) : null}
      <PhoneOtpForm
        collectName={isSignUp}
        locale={locale}
        messages={messages}
        // The sign-in layout sends signed-in users on (to `next` or the app).
        onSignedIn={(userId) => {
          identify(userId);
          track(isSignUp ? "sign_up" : "login", { method: "phone" });
        }}
        supabase={supabase}
      />
      <p className="text-center text-muted-foreground text-sm">
        {isSignUp ? t("signUp.haveAccount") : t("signIn.noAccount")}{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href={{
            pathname: isSignUp ? "/sign-in" : "/sign-up",
            query: next ? { next } : {},
          }}
        >
          {isSignUp ? t("signUp.signInLink") : t("signIn.signUpLink")}
        </Link>
      </p>
    </div>
  );
};

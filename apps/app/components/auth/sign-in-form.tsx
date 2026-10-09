"use client";

import {
  isAuibEmail,
  sendMagicLink,
  signInWithPassword,
} from "@repo/auth/email";
import { passkeysSupported, signInWithPasskey } from "@repo/auth/passkeys";
import { useAuth } from "@repo/auth/provider";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Link } from "@repo/internationalization/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAuthError, usePasskeyError } from "@/lib/auth-messages";
import { callbackUrl, safeNextPath } from "@/lib/navigation";

export const SignInForm = () => {
  const t = useTranslations("auth");
  const errorText = useAuthError();
  const passkeyErrorText = usePasskeyError();
  const { supabase } = useAuth();
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const id = useId();
  const [email, setEmail] = useState("");
  // AUIB addresses sign in by link by default (no password to remember);
  // anyone can switch either way.
  const [chosen, setChosen] = useState<"password" | "link" | null>(null);
  const mode = chosen ?? (isAuibEmail(email) ? "link" : "password");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [linkSent, setLinkSent] = useState(false);
  // Checked after mount: the page is prerendered without a browser.
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  useEffect(() => setCanUsePasskey(passkeysSupported()), []);

  // One request at a time: a second magic-link request replaces the first
  // link and this browser's PKCE verifier (see ForgotForm).
  const inFlight = useRef<boolean>(false);

  let submitLabel = pending ? t("forgot.sending") : t("signIn.sendLink");
  if (mode === "password") {
    submitLabel = pending ? t("signIn.submitting") : t("signIn.submit");
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    const result =
      mode === "password"
        ? await signInWithPassword(supabase, email, password)
        : await sendMagicLink(supabase, email, callbackUrl(locale, next));
    inFlight.current = false;
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.code));
    } else if (mode === "link") {
      setLinkSent(true);
    }
    // Password sign-in: GuestOnly sends the member on to `next`.
  };

  const signInPasskey = async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    const result = await signInWithPasskey(supabase);
    inFlight.current = false;
    setPending(false);
    if (!result.ok) {
      setError(passkeyErrorText(result.code));
    }
    // Signed in: GuestOnly sends the member on to `next`.
  };

  return (
    <>
      <FormHeader title={t("signIn.title")}>
        {t("signIn.description")}
      </FormHeader>
      {params.get("deleted") ? (
        <p role="status">{t("signIn.deleted")}</p>
      ) : null}
      {linkSent ? (
        <p role="status">{t("signIn.linkSent", { email })}</p>
      ) : (
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>{t("email")}</Label>
            <Input
              aria-describedby={`${id}-email-hint`}
              autoComplete="email"
              dir="ltr"
              id={`${id}-email`}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <p className="type-caption" id={`${id}-email-hint`}>
              {t("emailHint")}
            </p>
          </div>
          {mode === "link" && chosen === null ? (
            <p className="type-body" role="status">
              {t("signIn.auibLink")}
            </p>
          ) : null}
          {mode === "password" ? (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-password`}>{t("password")}</Label>
              <Input
                autoComplete="current-password"
                dir="ltr"
                id={`${id}-password`}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
          ) : null}
          {error ? (
            <p className="text-title" role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {submitLabel}
          </Button>
          <Button
            onClick={() => {
              setError(undefined);
              setChosen(mode === "password" ? "link" : "password");
            }}
            type="button"
            variant="link"
          >
            {mode === "password"
              ? t("signIn.magicLink")
              : t("signIn.usePassword")}
          </Button>
          {canUsePasskey ? (
            <Button
              disabled={pending}
              onClick={signInPasskey}
              type="button"
              variant="outline"
            >
              {t("signIn.passkey")}
            </Button>
          ) : null}
        </form>
      )}
      <nav className="type-body grid gap-2">
        <Link className="underline underline-offset-4" href="/forgot-password">
          {t("signIn.forgot")}
        </Link>
        <p>
          {t("signIn.noAccount")}{" "}
          <Link
            className="underline underline-offset-4"
            href={{ pathname: "/sign-up", query: next ? { next } : {} }}
          >
            {t("signIn.createAccount")}
          </Link>
        </p>
      </nav>
    </>
  );
};

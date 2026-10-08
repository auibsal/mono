"use client";

import { useAuth } from "@repo/auth/provider";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { isLocale } from "@repo/internationalization";
import { Link, useRouter } from "@repo/internationalization/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { safeNextPath, stripLocale } from "@/lib/navigation";

const types = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

/** The Nexus URL the email was asked to return to (`{{ .RedirectTo }}`). */
const returnUrl = (value: string | null) => {
  try {
    const url = new URL(value ?? "");
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
};

/**
 * Landing page for links in Supabase Auth emails, which point here with a
 * token hash rather than at Supabase. Nothing is verified until the member
 * presses Continue: mail scanners (Microsoft Safe Links) open links before
 * people do, and would otherwise spend the one-time token. No PKCE verifier
 * is involved, so the link also works in another browser.
 */
export const AuthConfirm = () => {
  const t = useTranslations("auth");
  const { supabase } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const valid = Boolean(tokenHash && type && types.has(type));
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(!valid);
  const inFlight = useRef<boolean>(false);

  // The link carries no language; follow the page the member asked from.
  useEffect(() => {
    const [, first] = returnUrl(params.get("next"))?.pathname.split("/") ?? [];
    if (isLocale(first) && first !== locale) {
      router.replace(`/auth/confirm?${params.toString()}`, { locale: first });
    }
  }, [locale, params, router]);

  const confirm = async () => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: set by an earlier press still awaiting
    if (inFlight.current || !(tokenHash && type)) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    // A link pressed twice has a spent token but a live session.
    const signedIn =
      !error || Boolean((await supabase.auth.getSession()).data.session);
    inFlight.current = false;
    setPending(false);
    if (!signedIn) {
      setFailed(true);
      return;
    }
    const back = returnUrl(params.get("next"));
    const next = safeNextPath(back?.searchParams.get("next"));
    router.replace(next ? stripLocale(next) : "/");
  };

  if (failed) {
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
        id="main"
      >
        <p role="alert">{t("callback.failed")}</p>
        <Button asChild variant="outline">
          <Link href="/sign-in">{t("callback.retry")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6"
      id="main"
    >
      <FormHeader title={t("confirm.title")}>
        {t(type === "recovery" ? "confirm.recovery" : "confirm.body")}
      </FormHeader>
      <Button disabled={pending} onClick={confirm} type="button">
        {pending ? t("confirm.pending") : t("confirm.continue")}
      </Button>
    </main>
  );
};

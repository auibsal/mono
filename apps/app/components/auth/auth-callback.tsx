"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Link, useRouter } from "@repo/internationalization/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FullPageSpinner } from "@/components/states";
import { safeNextPath, stripLocale } from "@/lib/navigation";

/**
 * Landing page for confirmation, magic and recovery links (PKCE): exchanges
 * the code for a session, then returns the member to where they started.
 */
export const AuthCallback = () => {
  const t = useTranslations("auth.callback");
  const { supabase } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));
  const [failed, setFailed] = useState(false);
  // A code can be exchanged once; keep the promise so a second effect run
  // (React strict mode) waits for the same exchange.
  const exchange = useRef<Promise<{ error: AuthError | null }> | null>(null);

  useEffect(() => {
    if (!code) {
      setFailed(true);
      return;
    }

    exchange.current ??= supabase.auth.exchangeCodeForSession(code);
    exchange.current.then(({ error }) => {
      if (error) {
        setFailed(true);
      } else {
        router.replace(next ? stripLocale(next) : "/");
      }
    });
  }, [code, next, router, supabase]);

  if (!failed) {
    return <FullPageSpinner />;
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
      id="main"
    >
      <p role="alert">{t("failed")}</p>
      <Button asChild variant="outline">
        <Link href="/sign-in">{t("retry")}</Link>
      </Button>
    </main>
  );
};

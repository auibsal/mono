"use client";

import { sendPasswordReset } from "@repo/auth/email";
import { useAuth } from "@repo/auth/provider";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useAuthError } from "@/lib/auth-messages";

export const ForgotForm = () => {
  const t = useTranslations("auth");
  const errorText = useAuthError();
  const { supabase } = useAuth();
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await sendPasswordReset(
      supabase,
      email,
      `${window.location.origin}/${locale}/auth/callback?next=/${locale}/auth/reset`
    );
    if (result.ok) {
      setSent(true);
    } else {
      setError(errorText(result.code));
    }
  };

  return (
    <>
      <FormHeader title={t("forgot.title")}>
        {t("forgot.description")}
      </FormHeader>
      {sent ? (
        <p role="status">{t("forgot.sent", { email })}</p>
      ) : (
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>{t("email")}</Label>
            <Input
              autoComplete="email"
              dir="ltr"
              id={`${id}-email`}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          {error ? (
            <p className="text-title" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit">{t("forgot.submit")}</Button>
        </form>
      )}
    </>
  );
};

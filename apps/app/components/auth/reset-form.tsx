"use client";

import { MIN_PASSWORD_LENGTH, toEmailAuthError } from "@repo/auth/email";
import { useAuth } from "@repo/auth/provider";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Link } from "@repo/internationalization/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useAuthError } from "@/lib/auth-messages";
import { RequireAuth } from "../gates";

/** New password after a recovery link (the callback signed the member in). */
export const ResetForm = () => {
  const t = useTranslations("auth");
  const errorText = useAuthError();
  const { supabase } = useAuth();
  const id = useId();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(errorText("weak_password"));
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(errorText(toEmailAuthError(updateError)));
    } else {
      setDone(true);
    }
  };

  return (
    <RequireAuth>
      <FormHeader title={t("reset.title")} />
      {done ? (
        <p role="status">
          {t("reset.done")}{" "}
          <Link className="underline underline-offset-4" href="/">
            {t("signIn.submit")}
          </Link>
        </p>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password`}>{t("password")}</Label>
            <Input
              aria-describedby={`${id}-hint`}
              autoComplete="new-password"
              dir="ltr"
              id={`${id}-password`}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <p className="type-caption" id={`${id}-hint`}>
              {t("passwordHint")}
            </p>
          </div>
          {error ? (
            <p className="text-title" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit">{t("reset.submit")}</Button>
        </form>
      )}
    </RequireAuth>
  );
};

"use client";

import { isAuibEmail, signUpWithEmail } from "@repo/auth/email";
import { useAuth } from "@repo/auth/provider";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Link } from "@repo/internationalization/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useAuthError } from "@/lib/auth-messages";
import { callbackUrl, safeNextPath } from "@/lib/navigation";

export const SignUpForm = () => {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const errorText = useAuthError();
  const { supabase } = useAuth();
  const locale = useLocale();
  const next = safeNextPath(useSearchParams().get("next"));
  const id = useId();
  const [values, setValues] = useState({
    email: "",
    fullNameAr: "",
    fullNameEn: "",
    password: "",
    statement: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const external = values.email.includes("@") && !isAuibEmail(values.email);

  const set =
    (key: keyof typeof values) => (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const result = await signUpWithEmail(supabase, {
      email: values.email,
      fullNameAr: values.fullNameAr,
      fullNameEn: values.fullNameEn,
      locale: locale === "ar" ? "ar" : "en",
      password: values.password,
      // The confirmation link brings the member back to what they started.
      redirectTo: callbackUrl(locale, next),
      verificationStatement: values.statement,
    });
    setPending(false);
    if (result.ok) {
      setSentTo(values.email);
    } else {
      setError(errorText(result.code));
    }
  };

  if (sentTo) {
    return (
      <>
        <FormHeader title={t("signUp.checkInbox")} />
        <p role="status">{t("signUp.checkInboxBody", { email: sentTo })}</p>
      </>
    );
  }

  return (
    <>
      <FormHeader title={t("signUp.title")}>
        {t("signUp.description")}
      </FormHeader>
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-email`}>{t("email")}</Label>
          <Input
            aria-describedby={`${id}-email-hint`}
            autoComplete="email"
            dir="ltr"
            id={`${id}-email`}
            inputMode="email"
            onChange={set("email")}
            required
            type="email"
            value={values.email}
          />
          <p className="type-caption" id={`${id}-email-hint`}>
            {t("emailHint")}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name-en`}>{t("signUp.fullNameEn")}</Label>
          <Input
            autoComplete="name"
            dir="ltr"
            id={`${id}-name-en`}
            maxLength={120}
            onChange={set("fullNameEn")}
            required
            value={values.fullNameEn}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name-ar`}>
            {t("signUp.fullNameAr")}{" "}
            <span className="type-caption">({tc("optional")})</span>
          </Label>
          <Input
            dir="rtl"
            id={`${id}-name-ar`}
            lang="ar"
            maxLength={120}
            onChange={set("fullNameAr")}
            value={values.fullNameAr}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-password`}>{t("password")}</Label>
          <Input
            aria-describedby={`${id}-password-hint`}
            autoComplete="new-password"
            dir="ltr"
            id={`${id}-password`}
            minLength={10}
            onChange={set("password")}
            required
            type="password"
            value={values.password}
          />
          <p className="type-caption" id={`${id}-password-hint`}>
            {t("passwordHint")}
          </p>
        </div>
        {external ? (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-statement`}>{t("signUp.statement")}</Label>
            <Textarea
              aria-describedby={`${id}-statement-hint`}
              id={`${id}-statement`}
              maxLength={1000}
              onChange={set("statement")}
              rows={3}
              value={values.statement}
            />
            <p className="type-caption" id={`${id}-statement-hint`}>
              {t("signUp.statementHint")}
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="text-title" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={pending || !values.fullNameEn.trim()} type="submit">
          {pending ? t("signUp.submitting") : t("signUp.submit")}
        </Button>
      </form>
      <p className="type-body">
        {t("signUp.haveAccount")}{" "}
        <Link
          className="underline underline-offset-4"
          href={{ pathname: "/sign-in", query: next ? { next } : {} }}
        >
          {t("signUp.signIn")}
        </Link>
      </p>
    </>
  );
};

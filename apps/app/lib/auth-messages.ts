"use client";

import type { AuthMessages } from "@repo/auth/messages";
import { useTranslations } from "next-intl";

/** The auth components' texts from the `auth` messages. */
export const useAuthMessages = (): AuthMessages => {
  const t = useTranslations("auth");

  return {
    changePhone: t("changePhone"),
    codeLabel: t("codeLabel"),
    // The component fills in {phone} and {seconds} itself.
    codeSentTo: t.raw("codeSentTo") as string,
    continue: t("continue"),
    createOrganization: t("createOrganization"),
    errors: {
      captcha_failed: t("errors.captcha_failed"),
      delivery_failed: t("errors.delivery_failed"),
      invalid_code: t("errors.invalid_code"),
      invalid_phone: t("errors.invalid_phone"),
      rate_limited: t("errors.rate_limited"),
      signups_disabled: t("errors.signups_disabled"),
      unknown: t("errors.unknown"),
    },
    fullNameLabel: t("fullNameLabel"),
    organizations: t("organizations"),
    phoneHint: t("phoneHint"),
    phoneLabel: t("phoneLabel"),
    resend: t("resend"),
    resendIn: t.raw("resendIn") as string,
    sending: t("sending"),
    signOut: t("signOut"),
    verify: t("verify"),
    verifying: t("verifying"),
  };
};

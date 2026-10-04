"use client";

import type { EmailAuthErrorCode } from "@repo/auth/email";
import { useTranslations } from "next-intl";

/** The translated text for an auth error code. */
export const useAuthError = () => {
  const t = useTranslations("auth.errors");
  return (code: EmailAuthErrorCode) => t(code);
};

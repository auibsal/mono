"use client";

import type { EmailAuthErrorCode } from "@repo/auth/email";
import type { PasskeyErrorCode } from "@repo/auth/passkeys";
import { useTranslations } from "next-intl";

/** The translated text for an auth error code. */
export const useAuthError = () => {
  const t = useTranslations("auth.errors");
  return (code: EmailAuthErrorCode) => t(code);
};

/** The translated text for a passkey error code. */
export const usePasskeyError = () => {
  const t = useTranslations("auth.passkeyErrors");
  return (code: PasskeyErrorCode) => t(code);
};

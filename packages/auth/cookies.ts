import type { CookieOptionsWithName } from "@supabase/ssr";
import { keys } from "./keys";

/**
 * Session cookie settings shared by every SAL host. With
 * NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=".auibsal.org" the cookie is sent to
 * auibsal.org, nexus.auibsal.org and api.auibsal.org alike.
 */
export const authCookieOptions = (): CookieOptionsWithName => {
  const domain = keys().NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
};

import "server-only";

import type { Database } from "@repo/database";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authCookieOptions } from "./cookies";
import { keys } from "./keys";

/** Session-bound client for Server Components, Route Handlers and Actions. */
export const createClient = async () => {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();

  if (!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error(
      "Supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this can be ignored.
          }
        },
      },
    }
  );
};

/** The signed-in user, verified with the Auth server (null if signed out). */
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return data.user ?? null;
});

/**
 * The caller's user id from the verified JWT (null if signed out). Roles and
 * permissions come from the database (access.has_permission), never from
 * the token's metadata. Cached per request.
 */
export const auth = cache(async () => {
  const supabase = await createClient();
  // Verifies the JWT locally with the project's signing keys when available.
  const { data } = await supabase.auth.getClaims();

  return { userId: data?.claims.sub ?? null };
});

/** Redirects to the sign-in page when nobody is signed in. */
export const requireUser = async (signInPath = "/sign-in") => {
  const user = await currentUser();

  if (!user) {
    redirect(signInPath);
  }

  return user;
};

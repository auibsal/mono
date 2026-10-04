import type { Database } from "@repo/database";
import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptions } from "./cookies";
import { keys } from "./keys";

/**
 * Browser client. Sessions live in cookies on the shared parent domain, so
 * the public site, the Nexus and the API see the same sign-in.
 * (`createBrowserClient` reuses one instance per page.)
 */
export const createClient = () => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();

  if (!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error(
      "Supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: authCookieOptions() }
  );
};

export type BrowserClient = ReturnType<typeof createClient>;

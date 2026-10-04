import type { Database } from "@repo/database";
import { createBrowserClient } from "@supabase/ssr";
import { keys } from "./keys";

/**
 * Browser client for the web build. Sessions live in cookies so server
 * components and the proxy can read them. (`createBrowserClient` reuses one
 * instance per page.) The Capacitor apps use `createNativeClient` instead.
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
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
};

export type BrowserClient = ReturnType<typeof createClient>;

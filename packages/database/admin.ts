import "server-only";

import { createClient } from "@supabase/supabase-js";
import { keys } from "./keys";
import type { Database } from "./types";

/**
 * Privileged Supabase client for trusted server code only (webhooks, cron
 * jobs, background work). It uses the secret key and therefore BYPASSES Row
 * Level Security. Never use it to serve data for a user request — use the
 * session-bound client from `@repo/auth/server` instead so RLS applies.
 *
 * A new client is created per call; there is no shared module-level client.
 */
export const createAdminClient = () => {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = keys();

  if (!(NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY)) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
};

export type AdminClient = ReturnType<typeof createAdminClient>;

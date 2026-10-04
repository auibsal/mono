import "server-only";

import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { keys } from "./keys";

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Authenticates an API request by its `Authorization: Bearer <access token>`
 * header — how the Capacitor apps and other origins call apps/api, where
 * cookies are not shared. Returns the verified claims and a client that acts
 * as that user, so Row Level Security applies to its queries.
 */
export const authenticateRequest = async (request: Request) => {
  const token = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();

  if (
    !(token && NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    return null;
  }

  const supabase = createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  const { data, error } = await supabase.auth.getClaims(token);

  if (error || !data) {
    return null;
  }

  return { claims: data.claims, supabase, userId: data.claims.sub };
};

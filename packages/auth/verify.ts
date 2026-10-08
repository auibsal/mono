import "server-only";

import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { keys } from "./keys";

const BEARER = /^Bearer\s+(.+)$/i;

interface AuthenticateOptions {
  /**
   * Accept tokens issued to third-party apps (Sign in with SAL). Off by
   * default: only the public `/v1` API takes them. Account deletion,
   * exports and signed URLs answer the Society's own apps only.
   */
  readonly apps?: boolean;
}

/**
 * Authenticates an API request by its `Authorization: Bearer <access token>`
 * header — how the Nexus (a static site on another origin) calls apps/api, where
 * cookies are not shared. Returns the verified claims and a client that acts
 * as that user, so Row Level Security applies to its queries. `clientId` is
 * the third-party app the token was issued to, or null for the Nexus.
 */
export const authenticateRequest = async (
  request: Request,
  { apps = false }: AuthenticateOptions = {}
) => {
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

  const clientId =
    typeof data.claims.client_id === "string" && data.claims.client_id
      ? data.claims.client_id
      : null;
  if (clientId && !apps) {
    return null;
  }

  return { claims: data.claims, clientId, supabase, userId: data.claims.sub };
};

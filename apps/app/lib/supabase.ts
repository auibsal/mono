import { createClient as createBrowserClient } from "@repo/auth/client";
import { createNativeClient } from "@repo/auth/native";
import type { Database } from "@repo/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { secureSessionStorage } from "./native/secure-storage";
import { isNativeApp } from "./platform";

let client: SupabaseClient<Database> | undefined;
let prerenderClient: SupabaseClient<Database> | undefined;

/**
 * Static prerendering (build time) renders the loading state only: queries
 * and auth listeners run in the browser. An inert client keeps the build
 * independent of the Supabase env vars; it never makes a request.
 */
const getPrerenderClient = () => {
  prerenderClient ??= createClient<Database>(
    "http://prerender.invalid",
    "prerender",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return prerenderClient;
};

/**
 * One Supabase client per app instance:
 *
 * - Web: the cookie-based browser client from @repo/auth.
 * - iOS/Android: plain supabase-js with PKCE, `detectSessionInUrl: false`
 *   (deep links are handled by the native bridge) and the session kept in
 *   the Keychain/Keystore.
 *
 * Every query runs as the signed-in user, so Row Level Security applies.
 */
export const getSupabase = () => {
  if (typeof window === "undefined") {
    return getPrerenderClient();
  }

  client ??= isNativeApp()
    ? createNativeClient(secureSessionStorage)
    : createBrowserClient();

  return client;
};

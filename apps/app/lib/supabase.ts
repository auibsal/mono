import { createClient as createBrowserClient } from "@repo/auth/client";
import type { Database } from "@repo/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 * One browser client per page, with the session in cookies on the shared
 * parent domain. Every query runs as the signed-in member, so Row Level
 * Security applies.
 */
export const getSupabase = () => {
  if (typeof window === "undefined") {
    return getPrerenderClient();
  }

  client ??= createBrowserClient();
  return client;
};

import "server-only";

import type { Database } from "@repo/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/** Cache tags revalidated on publish (apps/api → /api/revalidate). */
export const cacheTags = [
  "events",
  "journal",
  "news",
  "charity",
  "programmes",
  "documents",
  "about",
  "partners",
  "certificates",
  "productions",
] as const;
export type CacheTag = (typeof cacheTags)[number];

/**
 * Anonymous Supabase client for published reads. The publishable key and
 * RLS mean it can only see public rows; responses are cached by tag and
 * refreshed when content is published.
 */
export const publicClient = (
  ...tags: CacheTag[]
): SupabaseClient<Database> | null => {
  if (
    !(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    return null;
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            next: { revalidate: 3600, tags: [...tags] },
          }),
      },
    }
  );
};

/**
 * Runs a published-data read; a missing configuration or an outage renders
 * the section empty instead of failing the page.
 */
export const readPublished = async <T>(
  tags: CacheTag[],
  read: (client: SupabaseClient<Database>) => Promise<T>,
  fallback: T
): Promise<T> => {
  const client = publicClient(...tags);
  if (!client) {
    return fallback;
  }
  try {
    return await read(client);
  } catch {
    return fallback;
  }
};

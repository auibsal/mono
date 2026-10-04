import type { Database } from "@repo/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { keys } from "./keys";

/**
 * Key-value storage for the session. In the Capacitor apps, back this with
 * the iOS Keychain / Android Keystore (a secure-storage plugin); do not use
 * `@capacitor/preferences`, which is not encrypted.
 */
export interface SecureStorage {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

/** Minimal shape of `App` from `@capacitor/app`, to avoid a hard dependency. */
export interface AppLifecycle {
  addListener: (
    event: "appStateChange",
    listener: (state: { isActive: boolean }) => void
  ) => Promise<{ remove: () => Promise<void> }>;
}

/**
 * Supabase client for the Capacitor (iOS/Android) build. Static exports have
 * no server to set cookies, so the session is kept in secure storage and
 * OAuth/magic links use the PKCE flow with a deep link back into the app.
 */
export const createNativeClient = (storage: SecureStorage) => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();

  if (!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error(
      "Supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage,
      },
    }
  );
};

/**
 * Refreshes tokens only while the app is in the foreground, as Supabase
 * recommends for mobile apps. Returns a function that removes the listener.
 */
export const bindAuthToAppLifecycle = async (
  supabase: SupabaseClient<Database>,
  app: AppLifecycle
) => {
  const handle = await app.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => handle.remove();
};

/**
 * Completes an OAuth or magic-link sign-in from a deep link such as
 * `com.example.app://auth/callback?code=…` (PKCE code exchange).
 */
export const handleAuthDeepLink = async (
  supabase: SupabaseClient<Database>,
  url: string
) => {
  const code = new URL(url).searchParams.get("code");

  if (!code) {
    return false;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  return true;
};

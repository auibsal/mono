import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { SecureStorage as SessionStorage } from "@repo/auth/native";

/**
 * Supabase session storage for the Capacitor apps, backed by the iOS
 * Keychain and the Android Keystore. Never use @capacitor/preferences or
 * localStorage for tokens: neither is encrypted.
 */
export const secureSessionStorage: SessionStorage = {
  getItem: (key) => SecureStorage.getItem(key),
  removeItem: async (key) => {
    await SecureStorage.removeItem(key);
  },
  setItem: (key, value) => SecureStorage.setItem(key, value),
};

"use client";

import { bindAuthToAppLifecycle, handleAuthDeepLink } from "@repo/auth/native";
import { useAuth } from "@repo/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { preferredLocale, resolveLocalizedPath } from "@/lib/locale";
import { isNativeApp } from "@/lib/platform";

type Cleanup = () => unknown;

const TRAILING_SLASHES = /\/+$/;

/** The in-app path for a deep link (custom scheme or universal link). */
export const deepLinkPath = (url: string) => {
  const target = new URL(url);
  // https://app.example.iq/ar/billing → /ar/billing
  // com.example.app://ar/billing      → /ar/billing (the host is a segment)
  const pathname = target.protocol.startsWith("http")
    ? target.pathname
    : `/${target.host}${target.pathname}`;
  return `${pathname.replace(TRAILING_SLASHES, "") || "/"}${target.search}`;
};

/**
 * Native-only wiring (no-op on the web):
 *
 * - refreshes Supabase tokens only while the app is in the foreground;
 * - completes OAuth/magic-link sign-ins from `…://auth/callback?code=…`
 *   (PKCE) and routes other deep links into the app;
 * - Android back button: navigate back, or leave the app at the root.
 */
export const NativeBridge = () => {
  const { supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let disposed = false;
    const cleanups: Cleanup[] = [];
    const keep = (cleanup: Cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        cleanups.push(cleanup);
      }
    };

    const setup = async () => {
      const { App } = await import("@capacitor/app");

      keep(await bindAuthToAppLifecycle(supabase, App));

      const urlListener = await App.addListener(
        "appUrlOpen",
        async ({ url }) => {
          const locale = preferredLocale();
          try {
            if (await handleAuthDeepLink(supabase, url)) {
              router.replace(`/${locale}`);
              return;
            }
          } catch {
            router.replace(`/${locale}/sign-in`);
            return;
          }
          router.push(resolveLocalizedPath(deepLinkPath(url), locale));
        }
      );
      keep(() => urlListener.remove());

      const backListener = await App.addListener(
        "backButton",
        ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        }
      );
      keep(() => backListener.remove());
    };

    setup();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [router, supabase]);

  return null;
};

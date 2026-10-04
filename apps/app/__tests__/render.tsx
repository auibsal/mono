import { AuthProvider } from "@repo/auth/provider";
import type { Database } from "@repo/database";
import ar from "@repo/internationalization/messages/ar.json";
import en from "@repo/internationalization/messages/en.json";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { vi } from "vitest";

/** A Supabase client stand-in; tests override the methods they use. */
export const fakeSupabase = (overrides: Record<string, unknown> = {}) =>
  ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    rpc: vi.fn(),
    ...overrides,
  }) as unknown as SupabaseClient<Database>;

export const renderWithApp = (
  ui: ReactNode,
  {
    locale = "ar",
    supabase = fakeSupabase(),
  }: { locale?: "ar" | "en"; supabase?: SupabaseClient<Database> } = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? ar : en}
      timeZone="Asia/Baghdad"
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={supabase}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
};

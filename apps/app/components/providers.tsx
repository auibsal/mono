"use client";

import { AuthProvider } from "@repo/auth/provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface AppProvidersProps {
  readonly children: ReactNode;
}

/** Data fetching and the Supabase session. */
export const AppProviders = ({ children }: AppProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  );
  const [supabase] = useState(getSupabase);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={supabase}>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

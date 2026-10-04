"use client";

import type { Database } from "@repo/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "./client";

interface AuthContextValue {
  loading: boolean;
  supabase: SupabaseClient<Database>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  readonly children: ReactNode;
  /** Defaults to the cookie-based browser client; pass the native client in Capacitor. */
  readonly client?: SupabaseClient<Database>;
  /** User resolved on the server, to avoid a loading flash. */
  readonly initialUser?: User | null;
}

export const AuthProvider = ({
  children,
  client,
  initialUser,
}: AuthProviderProps) => {
  const supabase = useMemo(() => client ?? createClient(), [client]);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const value = useMemo(
    () => ({ loading, supabase, user }),
    [loading, supabase, user]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = () => {
  const context = use(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
};

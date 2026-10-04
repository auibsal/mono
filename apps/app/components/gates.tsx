"use client";

import { useAuth } from "@repo/auth/provider";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { type ReactNode, useEffect } from "react";
import { safeNextPath } from "@/lib/navigation";
import { FullPageSpinner } from "./states";

interface GateProps {
  readonly children: ReactNode;
}

/**
 * Shows its children only to signed-in users and sends everyone else to the
 * sign-in page (coming back afterwards). This is a convenience: the data is
 * protected by Row Level Security, not by this check.
 */
export const RequireAuth = ({ children }: GateProps) => {
  const { loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!(loading || user)) {
      router.replace({
        pathname: "/sign-in",
        query: { next: `${pathname}${window.location.search}` },
      });
    }
  }, [loading, pathname, router, user]);

  return loading || !user ? <FullPageSpinner /> : children;
};

/** Sign-in and sign-up pages: signed-in users go on to the app. */
export const GuestOnly = ({ children }: GateProps) => {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next) ?? "/");
    }
  }, [loading, router, user]);

  return loading || user ? <FullPageSpinner /> : children;
};

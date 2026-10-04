"use client";

import { useAuth } from "@repo/auth/provider";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { type ReactNode, useEffect } from "react";
import { safeNextPath } from "@/lib/navigation";
import { useMemberStatus, useProfile } from "@/lib/queries";
import { PendingVerification } from "./pending-verification";
import { ErrorState, FullPageSpinner } from "./states";

interface GateProps {
  readonly children: ReactNode;
}

/**
 * Shows its children only to signed-in users and sends everyone else to the
 * sign-in page (coming back afterwards). A convenience: the data is
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

/**
 * Members only: unverified accounts see the verification notice, and members
 * with a pledge to (re-)accept or setup to finish go to /setup first.
 */
export const RequireMember = ({ children }: GateProps) => {
  const status = useMemberStatus();
  const profile = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  const needsSetup =
    status.data?.verified &&
    (status.data.pending_pledges.length > 0 ||
      !profile.data?.setup_completed_at);

  useEffect(() => {
    if (needsSetup && profile.data) {
      router.replace({
        pathname: "/setup",
        query: { next: `${pathname}${window.location.search}` },
      });
    }
  }, [needsSetup, pathname, profile.data, router]);

  if (status.isError || profile.isError) {
    return (
      <ErrorState
        onRetry={() => Promise.all([status.refetch(), profile.refetch()])}
      />
    );
  }
  if (status.isPending || profile.isPending || needsSetup) {
    return <FullPageSpinner />;
  }
  if (!status.data?.verified) {
    return <PendingVerification />;
  }
  return children;
};

/** Sign-in and sign-up pages: signed-in users go on to the Nexus. */
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

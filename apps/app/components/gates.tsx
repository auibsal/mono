"use client";

import { useAuth } from "@repo/auth/provider";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { partners } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { safeNextPath } from "@/lib/navigation";
import { useMemberStatus, useProfile } from "@/lib/queries";
import { PartnerGuest, PendingVerification } from "./pending-verification";
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
 * Where people verified as a partner's members (not Society members) may
 * go: the Journal (calls opened to their partner), their profile, their
 * service and certificates. Row Level Security still decides every row.
 */
const GUEST_PATHS = ["/journal", "/profile", "/service", "/certificate"];

export const isGuestPath = (pathname: string) =>
  GUEST_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

/** True when the signed-in person is verified as a partner's member. */
const usePartnerGuest = (enabled: boolean) => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled,
    queryFn: async () =>
      (await partners.myAffiliations(supabase)).some(
        (a) => a.status === "verified"
      ),
    queryKey: ["affiliations", "guest", user?.id ?? ""],
  });
};

/**
 * Members only: unverified accounts see the verification notice (where they
 * can also say they belong to a partner), and members with a pledge to
 * (re-)accept or setup to finish go to /setup first. People verified as a
 * partner's members get the guest pages (`isGuestPath`), after the same
 * pledges and setup.
 */
export const RequireMember = ({ children }: GateProps) => {
  const status = useMemberStatus();
  const profile = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const unverified = status.isSuccess && !status.data?.verified;
  const guest = usePartnerGuest(unverified);
  const isGuest = unverified && guest.data === true;

  const needsSetup =
    (status.data?.verified || isGuest) &&
    ((status.data?.pending_pledges.length ?? 0) > 0 ||
      !profile.data?.setup_completed_at ||
      !profile.data.full_name_en.trim());

  useEffect(() => {
    if (needsSetup && profile.data) {
      router.replace({
        pathname: "/setup",
        query: { next: `${pathname}${window.location.search}` },
      });
    }
  }, [needsSetup, pathname, profile.data, router]);

  if (status.isError || profile.isError || guest.isError) {
    return (
      <ErrorState
        onRetry={() =>
          Promise.all([status.refetch(), profile.refetch(), guest.refetch()])
        }
      />
    );
  }
  if (
    status.isPending ||
    profile.isPending ||
    needsSetup ||
    (unverified && guest.isPending)
  ) {
    return <FullPageSpinner />;
  }
  if (isGuest) {
    return isGuestPath(pathname) ? children : <PartnerGuest />;
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

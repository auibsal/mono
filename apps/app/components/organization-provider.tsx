"use client";

import {
  type OrganizationMembership,
  pickActiveOrganization,
} from "@repo/auth/organizations";
import { useRouter } from "@repo/internationalization/navigation";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  readActiveOrganization,
  rememberActiveOrganization,
} from "@/lib/active-organization";
import { useMemberships } from "@/lib/queries";
import { ErrorState, FullPageSpinner } from "./states";

interface OrganizationContextValue {
  active: OrganizationMembership;
  /** True for owners and admins. */
  canManage: boolean;
  organizations: OrganizationMembership[];
  select: (organizationId: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null
);

/**
 * Loads the user's organizations and picks the active one (the last one
 * used, if the user is still a member). Users without an organization are
 * sent to onboarding.
 */
export const OrganizationProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const memberships = useMemberships();
  const router = useRouter();
  const [preferredId, setPreferredId] = useState(readActiveOrganization);
  const organizations = memberships.data;

  useEffect(() => {
    if (organizations?.length === 0) {
      router.replace("/onboarding");
    }
  }, [organizations, router]);

  const value = useMemo(() => {
    const active = organizations
      ? pickActiveOrganization(organizations, preferredId)
      : null;

    return active && organizations
      ? {
          active,
          canManage: active.role === "owner" || active.role === "admin",
          organizations,
          select: (organizationId: string) => {
            rememberActiveOrganization(organizationId);
            setPreferredId(organizationId);
          },
        }
      : null;
  }, [organizations, preferredId]);

  if (memberships.isError) {
    return <ErrorState onRetry={() => memberships.refetch()} />;
  }

  if (!value) {
    return <FullPageSpinner />;
  }

  return <OrganizationContext value={value}>{children}</OrganizationContext>;
};

export const useOrganization = () => {
  const context = use(OrganizationContext);

  if (!context) {
    throw new Error(
      "useOrganization must be used inside <OrganizationProvider>."
    );
  }

  return context;
};

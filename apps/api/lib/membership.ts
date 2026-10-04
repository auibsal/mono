import "server-only";

import type { authenticateRequest } from "@repo/auth/verify";
import type { OrgRole } from "@repo/database";

export type ApiSession = NonNullable<
  Awaited<ReturnType<typeof authenticateRequest>>
>;

/**
 * The caller's role in an organization, or null if they aren't a member.
 * Runs as the user, so Row Level Security decides what they can see.
 */
export const membershipRole = async (
  session: ApiSession,
  organizationId: string
): Promise<OrgRole | null> => {
  const { data } = await session.supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", session.userId)
    .maybeSingle();

  return data?.role ?? null;
};

export const isManager = (role: OrgRole | null) =>
  role === "owner" || role === "admin";

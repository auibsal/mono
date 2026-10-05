import "server-only";

import type { authenticateRequest } from "@repo/auth/verify";
import type { Permission, ScopeType } from "@repo/rbac";

export type ApiSession = NonNullable<
  Awaited<ReturnType<typeof authenticateRequest>>
>;

/**
 * Re-checks a permission server-side with access.has_permission(), run as
 * the caller (their JWT), never trusting anything the client claims.
 */
export const hasPermission = async (
  session: ApiSession,
  permission: Permission,
  scopeType: ScopeType = "global",
  scopeId: string | null = null
) => {
  const { data, error } = await session.supabase
    .schema("access")
    .rpc("has_permission", {
      permission,
      scope_id: scopeId ?? undefined,
      scope_type: scopeType,
    });
  return !error && data === true;
};

/** The permission in any scope (for showing a module or list at all). */
export const hasPermissionAnywhere = async (
  session: ApiSession,
  permission: Permission
) => {
  const { data, error } = await session.supabase
    .schema("access")
    .rpc("has_permission_anywhere", { permission });
  return !error && data === true;
};

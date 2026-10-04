import type { Permission, ScopeType } from "./permissions";

/** One row of `access.my_permissions()`. */
export interface Grant {
  permission: string;
  scope_id: string | null;
  scope_type: string;
}

/**
 * Client-side mirror of `access.has_permission()`, for deciding what to SHOW.
 * Row Level Security makes the real decision on every read and write.
 * A global grant covers every scope.
 */
export const hasPermission = (
  grants: readonly Grant[] | undefined,
  permission: Permission,
  scopeType: ScopeType = "global",
  scopeId: string | null = null
) =>
  (grants ?? []).some(
    (grant) =>
      grant.permission === permission &&
      (grant.scope_type === "global" ||
        (grant.scope_type === scopeType && grant.scope_id === scopeId))
  );

/** True when the permission is held in any scope (to show a module at all). */
export const hasPermissionAnywhere = (
  grants: readonly Grant[] | undefined,
  permission: Permission
) => (grants ?? []).some((grant) => grant.permission === permission);

/** The scopes (e.g. programme ids) in which a permission is held. */
export const scopesFor = (
  grants: readonly Grant[] | undefined,
  permission: Permission,
  scopeType: ScopeType
) => {
  const relevant = (grants ?? []).filter((g) => g.permission === permission);

  if (relevant.some((g) => g.scope_type === "global")) {
    return "all" as const;
  }

  return relevant
    .filter((g) => g.scope_type === scopeType && g.scope_id)
    .map((g) => g.scope_id as string);
};

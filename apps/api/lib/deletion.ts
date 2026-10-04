import type { Database } from "@repo/database";
import { buckets, removeFolder } from "@repo/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** An organization the user alone owns (from `account_deletion_blockers`). */
export type DeletionBlocker =
  Database["public"]["Functions"]["account_deletion_blockers"]["Returns"][number];

export type AccountDeletion =
  | { status: "deleted"; removedFiles: number }
  | { organizations: DeletionBlocker[]; status: "blocked" };

interface Clients {
  /** Secret-key client: deletes files and the auth user. */
  admin: Client;
  /** Client acting as the caller, so Row Level Security applies. */
  user: Client;
}

/**
 * Deletes the caller's account. Organizations they alone own must be
 * handed over or deleted first; otherwise nothing is changed and the list
 * is returned so the app can help resolve them.
 *
 * Deleting the auth user cascades to the profile and memberships and
 * clears authorship columns (see the account deletion migration). The
 * avatar folder is removed first, as files have no foreign key to users.
 */
export const deleteAccount = async (
  { admin, user }: Clients,
  userId: string
): Promise<AccountDeletion> => {
  const { data: blockers, error } = await user.rpc("account_deletion_blockers");
  if (error) {
    throw error;
  }
  if (blockers.length > 0) {
    return { organizations: blockers, status: "blocked" };
  }

  const removedFiles = await removeFolder(admin, buckets.avatars.id, userId);

  // The database still refuses if the user became a sole owner meanwhile.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw deleteError;
  }

  return { removedFiles, status: "deleted" };
};

export type OrganizationDeletion =
  | { removedFiles: number; status: "deleted" }
  | { status: "forbidden" };

/**
 * Deletes an organization and its files. The delete runs as the caller, so
 * the RLS policy decides (owners only); its projects, memberships,
 * invitations and subscription go with it, payments are kept with the
 * organization cleared.
 */
export const deleteOrganization = async (
  { admin, user }: Clients,
  organizationId: string
): Promise<OrganizationDeletion> => {
  const { data, error } = await user
    .from("organizations")
    .delete()
    .eq("id", organizationId)
    .select("id");
  if (error) {
    throw error;
  }
  if (data.length === 0) {
    return { status: "forbidden" };
  }

  const removedFiles = await removeFolder(
    admin,
    buckets.orgFiles.id,
    organizationId
  );

  return { removedFiles, status: "deleted" };
};

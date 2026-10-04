import type { Database } from "@repo/database";
import { buckets, removeFolder } from "@repo/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface AccountDeletion {
  removedFiles: number;
  status: "deleted";
}

/**
 * Deletes the caller's account. The avatar folder goes first (files have no
 * foreign key to users); deleting the auth user then cascades to the
 * profile, membership, pledges, RSVPs and role assignments. Ledger entries
 * and ballots are kept (append-only), with no link back to the person.
 */
export const deleteAccount = async (
  admin: Client,
  userId: string
): Promise<AccountDeletion> => {
  const removedFiles = await removeFolder(
    admin,
    buckets.media.id,
    `avatars/${userId}`
  );

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }

  return { removedFiles, status: "deleted" };
};

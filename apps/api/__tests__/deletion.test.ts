import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";
import { deleteAccount, deleteOrganization } from "../lib/deletion";

type Client = SupabaseClient<Database>;

const USER_ID = "00000000-0000-0000-0000-00000000000a";
const ORG_ID = "10000000-0000-0000-0000-000000000001";

/** Admin client stand-in: an empty storage folder and a recorded deleteUser. */
const fakeAdmin = (deleteError: Error | null = null) => {
  const deleteUser = vi.fn(() => Promise.resolve({ error: deleteError }));
  const bucket = {
    list: vi.fn(() =>
      Promise.resolve({ data: [{ id: "1", name: "me.png" }], error: null })
    ),
    remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const admin = {
    auth: { admin: { deleteUser } },
    storage: { from: vi.fn(() => bucket) },
  } as unknown as Client;
  return { admin, bucket, deleteUser };
};

const fakeUser = (blockers: unknown[]) =>
  ({
    rpc: vi.fn(() => Promise.resolve({ data: blockers, error: null })),
  }) as unknown as Client;

describe("deleteAccount", () => {
  test("refuses while the user alone owns an organization", async () => {
    const { admin, bucket, deleteUser } = fakeAdmin();
    const blocker = {
      name: "Org One",
      organization_id: ORG_ID,
      other_members: 2,
      slug: "org-one",
    };

    await expect(
      deleteAccount({ admin, user: fakeUser([blocker]) }, USER_ID)
    ).resolves.toEqual({ organizations: [blocker], status: "blocked" });
    expect(bucket.remove).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test("removes the avatar folder, then the user", async () => {
    const { admin, bucket, deleteUser } = fakeAdmin();

    await expect(
      deleteAccount({ admin, user: fakeUser([]) }, USER_ID)
    ).resolves.toEqual({ removedFiles: 1, status: "deleted" });
    expect(admin.storage.from).toHaveBeenCalledWith("avatars");
    expect(bucket.remove).toHaveBeenCalledWith([`${USER_ID}/me.png`]);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  test("surfaces a refusal from the database", async () => {
    const { admin } = fakeAdmin(
      new Error("An organization must keep at least one owner")
    );

    await expect(
      deleteAccount({ admin, user: fakeUser([]) }, USER_ID)
    ).rejects.toThrow("at least one owner");
  });
});

describe("deleteOrganization", () => {
  const userDeleting = (rows: { id: string }[]) => {
    const select = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    const eq = vi.fn(() => ({ select }));
    const remove = vi.fn(() => ({ eq }));
    const user = {
      from: vi.fn(() => ({ delete: remove })),
    } as unknown as Client;
    return { eq, user };
  };

  test("deletes as the caller, then removes the organization's files", async () => {
    const { admin, bucket } = fakeAdmin();
    const { eq, user } = userDeleting([{ id: ORG_ID }]);

    await expect(deleteOrganization({ admin, user }, ORG_ID)).resolves.toEqual({
      removedFiles: 1,
      status: "deleted",
    });
    expect(eq).toHaveBeenCalledWith("id", ORG_ID);
    expect(admin.storage.from).toHaveBeenCalledWith("org-files");
    expect(bucket.remove).toHaveBeenCalledWith([`${ORG_ID}/me.png`]);
  });

  test("leaves files alone when RLS refuses the delete", async () => {
    const { admin, bucket } = fakeAdmin();
    const { user } = userDeleting([]);

    await expect(deleteOrganization({ admin, user }, ORG_ID)).resolves.toEqual({
      status: "forbidden",
    });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

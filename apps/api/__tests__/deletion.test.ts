import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";
import { deleteAccount } from "../lib/deletion";

const USER_ID = "00000000-0000-0000-0000-00000000000a";

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
  } as unknown as SupabaseClient<Database>;
  return { admin, bucket, deleteUser };
};

test("removes the avatar folder, then the user", async () => {
  const { admin, bucket, deleteUser } = fakeAdmin();
  await expect(deleteAccount(admin, USER_ID)).resolves.toEqual({
    removedFiles: 1,
    status: "deleted",
  });
  expect(admin.storage.from).toHaveBeenCalledWith("media");
  expect(bucket.list).toHaveBeenCalledWith(
    `avatars/${USER_ID}`,
    expect.anything()
  );
  expect(bucket.remove).toHaveBeenCalledWith([`avatars/${USER_ID}/me.png`]);
  expect(deleteUser).toHaveBeenCalledWith(USER_ID);
});

test("surfaces an Auth error", async () => {
  const { admin } = fakeAdmin(new Error("nope"));
  await expect(deleteAccount(admin, USER_ID)).rejects.toThrow("nope");
});

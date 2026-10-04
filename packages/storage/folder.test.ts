import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";
import { removeFolder } from "./index";

interface Entry {
  id: string | null;
  name: string;
}

/** A storage client over an in-memory tree: folder path → entries. */
const fakeStorage = (tree: Record<string, Entry[]>) => {
  const removed: string[][] = [];
  const bucket = {
    list: vi.fn((path: string, { limit, offset }) =>
      Promise.resolve({
        data: (tree[path] ?? []).slice(offset, offset + limit),
        error: null,
      })
    ),
    remove: vi.fn((paths: string[]) => {
      removed.push(paths);
      return Promise.resolve({ data: [], error: null });
    }),
  };
  const client = {
    storage: { from: vi.fn(() => bucket) },
  } as unknown as SupabaseClient<Database>;
  return { bucket, client, removed };
};

test("removeFolder deletes every file, including subfolders", async () => {
  const { client, removed } = fakeStorage({
    org: [
      { id: "1", name: "a.pdf" },
      { id: null, name: "invoices" },
    ],
    "org/invoices": [{ id: "2", name: "2026.pdf" }],
  });

  await expect(removeFolder(client, "org-files", "org")).resolves.toBe(2);
  expect(removed.flat().sort()).toEqual(["org/a.pdf", "org/invoices/2026.pdf"]);
});

test("removeFolder pages through large folders", async () => {
  const files = Array.from({ length: 1500 }, (_, index) => ({
    id: String(index),
    name: `${index}.png`,
  }));
  const { bucket, client, removed } = fakeStorage({ user: files });

  await expect(removeFolder(client, "avatars", "user")).resolves.toBe(1500);
  expect(bucket.list).toHaveBeenCalledTimes(2);
  expect(removed.map((batch) => batch.length)).toEqual([1000, 500]);
});

test("removeFolder does nothing for an empty folder", async () => {
  const { bucket, client } = fakeStorage({});

  await expect(removeFolder(client, "avatars", "nobody")).resolves.toBe(0);
  expect(bucket.remove).not.toHaveBeenCalled();
});

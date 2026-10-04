import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { flagKeys, readFlags, settingKey } from "./index";

test("every flag is seeded as a setting, off by default", () => {
  const migrations = join(
    import.meta.dirname,
    "..",
    "database",
    "supabase",
    "migrations"
  );
  const sql = readdirSync(migrations)
    .map((f) => readFileSync(join(migrations, f), "utf8"))
    .join("\n");
  for (const flag of flagKeys) {
    expect(sql).toContain(`('${settingKey(flag)}', 'false', true`);
  }
});

test("missing rows fall back to the default", async () => {
  const fake = {
    schema: () => ({
      from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }),
    }),
  };
  expect(await readFlags(fake as any)).toEqual({ elections: false });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { changedFields } from "@/components/admin/system/activity";

describe("activity log", () => {
  test("lists only the fields an update changed", () => {
    expect(
      changedFields(
        { id: "1", status: "draft", title_en: "A", updated_at: "x" },
        { id: "1", status: "published", title_en: "A", updated_at: "y" }
      )
    ).toEqual(["status"]);
  });

  test("the table filter covers every table with an activity trigger", () => {
    const dir = join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "packages",
      "database",
      "supabase",
      "migrations"
    );
    const sql = readdirSync(dir)
      .map((file) => readFileSync(join(dir, file), "utf8"))
      .join("\n");
    const logged = [
      ...sql.matchAll(/log_activity after [a-z ,]+ on ([a-z_]+\.[a-z_]+)/g),
    ].map((m) => m[1]);
    const source = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "components",
        "admin",
        "system",
        "activity.tsx"
      ),
      "utf8"
    );
    for (const table of new Set(logged)) {
      expect(source, table).toContain(`"${table}"`);
    }
  });
});

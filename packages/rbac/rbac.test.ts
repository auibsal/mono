import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { personasSql } from "./fixtures";
import { hasPermission, hasPermissionAnywhere, scopesFor } from "./grants";
import { permissions } from "./permissions";
import { highestSpendingLimitIqd, roleKeys, roles } from "./roles";

const migrations = join(import.meta.dirname, "..", "database", "supabase", "migrations");
const referenceData = readFileSync(
  join(migrations, readdirSync(migrations).find((f) => f.endsWith("_reference_data.sql")) ?? ""),
  "utf8"
);

const section = (start: string, end: string) =>
  referenceData.slice(referenceData.indexOf(start), referenceData.indexOf(end));

describe("mirror of the reference-data migration", () => {
  test("permission keys match", () => {
    const sql = section("insert into access.permissions", "insert into access.roles");
    const keys = [...sql.matchAll(/\('([a-z_.]+)', '/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...permissions].sort());
  });

  test("roles and spending limits match", () => {
    const sql = section("insert into access.roles", "insert into access.role_permissions");
    const rows = [...sql.matchAll(/\('([a-z_]+)', '[^']+', '[^']+', (true|false), (null|\d+), \d+\)/g)];
    expect(rows.map((m) => m[1]).sort()).toEqual([...roleKeys].sort());
    for (const [, key, council, limit] of rows) {
      const role = roles[key as keyof typeof roles];
      expect(role.isCouncil, key).toBe(council === "true");
      expect(role.spendingLimitIqd, key).toBe(limit === "null" ? null : Number(limit));
    }
  });

  test("role bundles match", () => {
    const sql = section("insert into access.role_permissions", "insert into core.programmes");
    for (const [, key, list] of sql.matchAll(/\('([a-z_]+)', array\[([^\]]+)\]\)/g)) {
      const fromSql = [...list.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]).sort();
      expect([...roles[key as keyof typeof roles].permissions].sort(), key).toEqual(fromSql);
    }
  });

  test("Bylaws thresholds", () => {
    expect(roles.director.spendingLimitIqd).toBe(50_000);
    expect(roles.president.spendingLimitIqd).toBe(250_000);
    expect(highestSpendingLimitIqd).toBe(250_000);
  });

  test("only the Submissions Manager sees identities", () => {
    const holders = roleKeys.filter((key) =>
      (roles[key].permissions as readonly string[]).includes("journal.identity.view")
    );
    expect(holders).toEqual(["submissions_manager"]);
  });
});

describe("hasPermission mirror", () => {
  const grants = [
    { permission: "events.manage", scope_id: "p1", scope_type: "programme" },
    { permission: "audit.read", scope_id: null, scope_type: "global" },
  ];

  test("scoped grants cover only their scope", () => {
    expect(hasPermission(grants, "events.manage", "programme", "p1")).toBe(true);
    expect(hasPermission(grants, "events.manage", "programme", "p2")).toBe(false);
    expect(hasPermission(grants, "events.manage")).toBe(false);
    expect(hasPermissionAnywhere(grants, "events.manage")).toBe(true);
  });

  test("global grants cover every scope", () => {
    expect(hasPermission(grants, "audit.read", "issue", "i1")).toBe(true);
    expect(scopesFor(grants, "audit.read", "issue")).toBe("all");
    expect(scopesFor(grants, "events.manage", "programme")).toEqual(["p1"]);
  });

  test("no grants, no access", () => {
    expect(hasPermission(undefined, "roles.assign")).toBe(false);
  });
});

test("persona SQL quotes values", () => {
  expect(personasSql({ issue: "i" })).toContain("'submissions_manager', 'issue', 'i'");
});

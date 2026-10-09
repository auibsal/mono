import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { personasSql } from "./fixtures";
import { hasPermission, hasPermissionAnywhere, scopesFor } from "./grants";
import { permissions } from "./permissions";
import { highestSpendingLimitIqd, roleKeys, roles } from "./roles";

const migrations = join(
  import.meta.dirname,
  "..",
  "database",
  "supabase",
  "migrations"
);
// Every migration, in the order they run: reference data comes first, and
// later migrations may add permissions, roles and grants (never remove).
const sql = readdirSync(migrations)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrations, f), "utf8"))
  .join("\n");

/** The bodies of every `insert into <table> (...) values ...;` statement. */
const inserts = (table: string) =>
  [
    ...sql.matchAll(
      new RegExp(
        `insert into ${table} \\([^)]*\\)\\s*(?:values|select)([\\s\\S]*?);\\n`,
        "g"
      )
    ),
  ].map((m) => m[1]);

describe("mirror of the reference data in the migrations", () => {
  test("permission keys match", () => {
    const keys = inserts("access.permissions").flatMap((body) =>
      [...body.matchAll(/\('([a-z_.]+)', '/g)].map((m) => m[1])
    );
    expect(keys.sort()).toEqual([...permissions].sort());
  });

  test("roles and spending limits match", () => {
    const rows = inserts("access.roles").flatMap((body) => [
      ...body.matchAll(
        /\('([a-z_]+)', '[^']+', '[^']+', (true|false), (null|\d+), \d+\)/g
      ),
    ]);
    expect(rows.map((m) => m[1]).sort()).toEqual([...roleKeys].sort());
    for (const [, key, council, limit] of rows) {
      const role = roles[key as keyof typeof roles];
      expect(role.isCouncil, key).toBe(council === "true");
      expect(role.spendingLimitIqd, key).toBe(
        limit === "null" ? null : Number(limit)
      );
    }
  });

  test("role bundles match", () => {
    const fromSql = new Map<string, Set<string>>();
    const grant = (role: string, permission: string) =>
      fromSql.set(role, (fromSql.get(role) ?? new Set()).add(permission));
    for (const body of inserts("access.role_permissions")) {
      // Bundles: ('role', array['a', 'b']).
      for (const [, role, list] of body.matchAll(
        /\('([a-z_]+)', array\[([^\]]+)\]\)/g
      )) {
        for (const [, permission] of list.matchAll(/'([a-z_.]+)'/g)) {
          grant(role, permission);
        }
      }
      // Single grants: ('role', 'permission').
      for (const [, role, permission] of body.matchAll(
        /\('([a-z_]+)', '([a-z_.]+)'\)/g
      )) {
        grant(role, permission);
      }
    }
    for (const key of roleKeys) {
      expect([...roles[key].permissions].sort(), key).toEqual(
        [...(fromSql.get(key) ?? [])].sort()
      );
    }
  });

  test("Bylaws thresholds", () => {
    expect(roles.director.spendingLimitIqd).toBe(50_000);
    expect(roles.president.spendingLimitIqd).toBe(250_000);
    expect(highestSpendingLimitIqd).toBe(250_000);
  });

  test("only the Submissions Manager sees identities", () => {
    const holders = roleKeys.filter((key) =>
      (roles[key].permissions as readonly string[]).includes(
        "journal.identity.view"
      )
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
    expect(hasPermission(grants, "events.manage", "programme", "p1")).toBe(
      true
    );
    expect(hasPermission(grants, "events.manage", "programme", "p2")).toBe(
      false
    );
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
  expect(personasSql({ issue: "i" })).toContain(
    "'submissions_manager', 'issue', 'i'"
  );
});

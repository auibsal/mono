import { describe, expect, test } from "vitest";
import { isActiveAssignment, roleAssignmentSchema } from "./access";
import { manualActivitySchema } from "./membership";

const user = "0b6f6d5e-1f2a-4c3b-9d8e-7f6a5b4c3d2e";
const base = {
  ends_at: null,
  role_key: "director",
  scope_id: null,
  scope_type: "global" as const,
  starts_at: "2026-10-05T09:00:00.000Z",
  target_user: user,
};

describe("role assignments", () => {
  test("a global role has no scope id; a scoped role needs one", () => {
    expect(roleAssignmentSchema.safeParse(base).success).toBe(true);
    expect(
      roleAssignmentSchema.safeParse({ ...base, scope_type: "programme" })
        .success
    ).toBe(false);
    expect(
      roleAssignmentSchema.safeParse({ ...base, scope_id: user }).success
    ).toBe(false);
  });

  test("an assignment cannot end before it starts (as in the table check)", () => {
    expect(
      roleAssignmentSchema.safeParse({
        ...base,
        ends_at: "2026-10-04T09:00:00.000Z",
      }).success
    ).toBe(false);
  });

  test("active means started and not yet ended", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(isActiveAssignment(base, now)).toBe(true);
    expect(
      isActiveAssignment({ ...base, ends_at: "2026-10-05T11:00:00Z" }, now)
    ).toBe(false);
    expect(
      isActiveAssignment({ ...base, starts_at: "2026-10-06T00:00:00Z" }, now)
    ).toBe(false);
  });
});

describe("manual activity records", () => {
  test("need a note, as the database requires", () => {
    const record = {
      note: "Helped at the book fair",
      occurred_at: "2026-10-05T09:00:00.000Z",
      target_user: user,
    };
    expect(manualActivitySchema.safeParse(record).success).toBe(true);
    expect(
      manualActivitySchema.safeParse({ ...record, note: "  " }).success
    ).toBe(false);
  });
});

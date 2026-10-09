import { describe, expect, test } from "vitest";
import {
  agreementSchema,
  daysUntil,
  declarationSchema,
  partnerSchema,
  renewalsDue,
} from "./partners";

describe("partners", () => {
  test("a partner needs a slug, a name and https links", () => {
    const base = {
      is_listed: false,
      kind: "cultural",
      name_en: "Poetry Hub",
      reach: "iraq",
      slug: "poetry-hub",
      status: "prospect",
    } as const;
    expect(partnerSchema.parse({ ...base, url: "" }).url).toBeNull();
    expect(() =>
      partnerSchema.parse({ ...base, url: "http://example.com" })
    ).toThrow();
    expect(() =>
      partnerSchema.parse({ ...base, slug: "Poetry Hub" })
    ).toThrow();
  });

  test("memoranda end after they start and use MOU codes", () => {
    const base = {
      grants: ["journal_submissions"],
      partner_id: "00000000-0000-4000-8000-000000000001",
      purpose_en: "Joint readings.",
      starts_on: "2026-10-09",
    } as const;
    expect(agreementSchema.safeParse(base).success).toBe(true);
    expect(
      agreementSchema.safeParse({ ...base, ends_on: "2026-10-01" }).success
    ).toBe(false);
    expect(agreementSchema.safeParse({ ...base, code: "MOU-1" }).success).toBe(
      false
    );
    expect(
      agreementSchema.safeParse({ ...base, grants: ["payments"] }).success
    ).toBe(false);
  });

  test("a declaration either lists conflicts or says there are none", () => {
    expect(
      declarationSchema.safeParse({ items: [], nothing_to_declare: true })
        .success
    ).toBe(true);
    expect(
      declarationSchema.safeParse({ items: [], nothing_to_declare: false })
        .success
    ).toBe(false);
    expect(
      declarationSchema.safeParse({
        items: [{ kind: "supplier", what: "My uncle's print shop" }],
        nothing_to_declare: true,
      }).success
    ).toBe(false);
  });

  test("renewals due within the window, overdue included", () => {
    const today = new Date("2026-10-09T12:00:00Z");
    expect(daysUntil("2026-10-19", today)).toBe(10);
    const due = renewalsDue(
      [
        { id: "soon", renew_by: "2026-10-30", status: "signed" },
        { id: "late", renew_by: "2026-09-01", status: "signed" },
        { id: "later", renew_by: "2027-03-01", status: "signed" },
        { id: "draft", renew_by: "2026-10-10", status: "draft" },
        { id: "none", renew_by: null, status: "signed" },
      ],
      30,
      today
    );
    expect(due.map((a) => a.id)).toEqual(["soon", "late"]);
  });
});

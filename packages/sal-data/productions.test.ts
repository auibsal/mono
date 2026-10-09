import { describe, expect, test } from "vitest";
import {
  creditSchema,
  needsRights,
  nextStage,
  productionSchema,
  reportSchema,
} from "./productions";

describe("productions", () => {
  test("stages move in order and end at closed", () => {
    expect(nextStage("proposal")).toBe("approved");
    expect(nextStage("tech")).toBe("performances");
    expect(nextStage("closed")).toBeNull();
    expect(nextStage("cancelled")).toBeNull();
  });

  test("performances need the rights cleared", () => {
    expect(needsRights("performances")).toBe(true);
    expect(needsRights("closed")).toBe(true);
    expect(needsRights("rehearsals")).toBe(false);
  });

  test("a production needs a slug and both titles", () => {
    const base = {
      kind: "staged_reading",
      script_origin: "original",
      slug: "the-reading",
      title_ar: "القراءة",
      title_en: "The Reading",
    } as const;
    expect(productionSchema.safeParse(base).success).toBe(true);
    expect(
      productionSchema.safeParse({ ...base, slug: "The Reading" }).success
    ).toBe(false);
    expect(productionSchema.safeParse({ ...base, title_ar: "" }).success).toBe(
      false
    );
  });

  test("a credit names a member or a person, not both", () => {
    const base = { department: "cast", role_en: "Ophelia" } as const;
    expect(
      creditSchema.safeParse({
        ...base,
        user_id: "00000000-0000-4000-8000-000000000001",
      }).success
    ).toBe(true);
    expect(
      creditSchema.safeParse({ ...base, person_name: "Guest Actor" }).success
    ).toBe(true);
    expect(creditSchema.safeParse(base).success).toBe(false);
    expect(
      creditSchema.safeParse({
        ...base,
        person_name: "Guest Actor",
        user_id: "00000000-0000-4000-8000-000000000001",
      }).success
    ).toBe(false);
  });

  test("the report (F-25 B) needs what happened, lessons and a verdict", () => {
    const report = {
      report_lessons: "Book the hall early.",
      report_money_in_iqd: null,
      report_money_out_iqd: 50_000,
      report_people_reached: 80,
      report_repeat: "Yes.",
      report_what_happened: "Two readings.",
    };
    expect(reportSchema.safeParse(report).success).toBe(true);
    expect(
      reportSchema.safeParse({ ...report, report_lessons: " " }).success
    ).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  cashTotals,
  claimTotal,
  formKeys,
  formProblems,
  forms,
  interviewTotal,
  interviewVeto,
} from "./forms";
import { fill, letterKeys, letters, letterText, placeholders } from "./letters";

const migration = readFileSync(
  new URL(
    "../database/supabase/migrations/20261009000500_forms.sql",
    import.meta.url
  ),
  "utf8"
);

describe("forms", () => {
  test("every form here is in the database registry, and only those", () => {
    const registered = [...migration.matchAll(/\('(f\d{2}[a-z]?)', 'F-/g)].map(
      (m) => m[1]
    );
    expect(registered.sort()).toEqual([...formKeys].sort());
  });

  test("anonymous and routed forms match the registry (F-20 only)", () => {
    const anonymous = formKeys.filter((key) => forms[key].anonymous);
    expect(anonymous).toEqual(["f20"]);
    expect(formKeys.filter((key) => forms[key].routing)).toEqual(["f20"]);
  });

  test("required fields, lengths, ranges and choices are checked", () => {
    const { f09 } = forms;
    expect(formProblems(f09, {})).toContain("title");
    const ok = {
      believes: "b",
      motion_type: "ordinary",
      notes: "n",
      resolves: "r",
      seconder: "s",
      title: "t",
    };
    expect(formProblems(f09, ok)).toEqual([]);
    expect(formProblems(f09, { ...ok, motion_type: "other" })).toEqual([
      "motion_type",
    ]);
    expect(formProblems(f09, { ...ok, title: "x".repeat(201) })).toEqual([
      "title",
    ]);
    expect(
      formProblems(forms.f04, { score_commitment: 6 }).includes(
        "score_commitment"
      )
    ).toBe(true);
    expect(
      formProblems(forms.f03, { work_link: "javascript:alert(1)" })
    ).toContain("work_link");
  });

  test("table rows need their required columns", () => {
    const base = {
      approved_by: "VP",
      budget_line: "Events",
      department: "Events",
      not_self_approved: true,
      payment: "Cash from the Treasurer",
      receipts_attached: true,
    };
    expect(formProblems(forms.f13, { ...base, items: [] })).toEqual(["items"]);
    expect(
      formProblems(forms.f13, {
        ...base,
        items: [{ amount: 5000, date: "2026-10-01", item: "Tea" }],
      })
    ).toEqual([]);
    expect(
      formProblems(forms.f13, { ...base, items: [{ item: "Tea" }] })
    ).toEqual(["items"]);
  });

  test("F-04 weighted total and the Commitment/Teamwork rule", () => {
    const all5 = {
      score_commitment: 5,
      score_ideas: 5,
      score_skills: 5,
      score_teamwork: 5,
      score_values: 5,
    };
    expect(interviewTotal(all5)).toBe(100);
    expect(interviewTotal({ ...all5, score_skills: 3 })).toBe(90);
    expect(interviewVeto(all5)).toBe(false);
    expect(interviewVeto({ ...all5, score_teamwork: 1 })).toBe(true);
  });

  test("F-13 and F-14 totals", () => {
    expect(claimTotal({ items: [{ amount: 5000 }, { amount: "2500" }] })).toBe(
      7500
    );
    expect(
      cashTotals({
        notes: { "250": { count1: 4 }, "50000": { count1: 2, count2: 2 } },
      })
    ).toEqual({ count1: 101_000, count2: 100_000 });
  });
});

describe("letters", () => {
  test("every letter has its fill-in fields", () => {
    for (const key of letterKeys) {
      expect(letters[key].paragraphs.length).toBeGreaterThan(0);
    }
    expect(placeholders(letters.l07)).toEqual([
      "partner contact",
      "name",
      "programme",
      "result: numbers, people reached, money raised",
      "One specific thing they did that made a difference.",
      "when",
      "Name",
    ]);
  });

  test("filled values replace brackets; empty ones stay marked", () => {
    const parts = fill("Dear [name], thank you for [programme].", {
      name: "Sara",
    });
    expect(parts.map((p) => p.text).join("")).toBe(
      "Dear Sara, thank you for [programme]."
    );
    expect(parts.filter((p) => p.placeholder && !p.filled)).toHaveLength(1);
    expect(letterText(letters.l08, { name: "Dr. Huda" })).toContain(
      "Dear Dr. Huda,"
    );
  });
});

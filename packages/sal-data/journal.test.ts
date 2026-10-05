import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  averageTotal,
  band,
  canEditorMove,
  categories,
  criteria,
  editorMoves,
  needsThirdRead,
  rubric,
  rubricTotal,
  scoreSchema,
  submissionObjectPath,
  submissionSchema,
} from "./journal";

const TRANSITION_PAIR =
  /\(\s*\x27([a-z_]+)\x27(?:::journal\.submission_status)?,\s*\x27([a-z_]+)\x27(?:::journal\.submission_status)?\)/g;
const RANDOM_PDF_PATH = /^abc\/[0-9a-f-]{36}\.pdf$/;
const migrations = join(
  import.meta.dirname,
  "..",
  "database",
  "supabase",
  "migrations"
);
const journalSql = readFileSync(
  join(
    migrations,
    readdirSync(migrations).find((f) => f.endsWith("_journal.sql")) ?? ""
  ),
  "utf8"
);

describe("categories", () => {
  test("the form offers exactly the database's seven categories", () => {
    expect([...categories]).toEqual([
      "poetry",
      "fiction",
      "creative_nonfiction",
      "short_drama",
      "art_photography",
      "translation",
      "six_words",
    ]);
    for (const category of categories) {
      expect(journalSql).toContain(`'${category}'`);
    }
  });
});

describe("rubric v2", () => {
  test("limits match the database check constraints", () => {
    for (const key of criteria) {
      expect(journalSql).toContain(
        `${key} smallint not null check (${key} between ${rubric[key].min} and ${rubric[key].max})`
      );
    }
  });

  test("weights match the generated total column", () => {
    const formula = criteria
      .map((key) => `${key} * ${rubric[key].weight / rubric[key].max}`)
      .join(" + ");
    expect(journalSql.replace(/\s+/g, " ")).toContain(formula);
    expect(criteria.reduce((sum, key) => sum + rubric[key].weight, 0)).toBe(
      100
    );
  });

  test("the zod schema rejects out-of-range scores", () => {
    const valid = { archive_factor: 3, craft: 3, depth: 3, voice: 3 };
    expect(scoreSchema.safeParse(valid).success).toBe(true);
    expect(scoreSchema.safeParse({ ...valid, craft: 6 }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...valid, voice: 0 }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...valid, depth: 2.5 }).success).toBe(false);
  });

  test("totals, bands and the third-read rule", () => {
    expect(
      rubricTotal({ archive_factor: 5, craft: 5, depth: 5, voice: 5 })
    ).toBe(100);
    expect(
      rubricTotal({ archive_factor: 1, craft: 1, depth: 1, voice: 1 })
    ).toBe(20);
    expect(band(80)).toBe("strong");
    expect(band(65)).toBe("consider");
    expect(band(64)).toBe("decline");
    expect(needsThirdRead(80, 60)).toBe(false);
    expect(needsThirdRead(81, 60)).toBe(true);
  });
});

describe("submission form", () => {
  const base = {
    call_id: "00000000-0000-4000-8000-000000000001",
    human_authorship_confirmed: true as const,
    language: "en" as const,
    title: "Firsts",
  };

  test("a translation needs its source and a rights note", () => {
    expect(
      submissionSchema.safeParse({ ...base, category: "translation" }).success
    ).toBe(false);
    expect(
      submissionSchema.safeParse({
        ...base,
        category: "translation",
        rights_note: "PD",
        source_text: "x",
      }).success
    ).toBe(true);
  });

  test("the Human Authorship pledge is required", () => {
    expect(
      submissionSchema.safeParse({
        ...base,
        category: "poetry",
        human_authorship_confirmed: false,
      }).success
    ).toBe(false);
  });

  test("files get random names under the submission folder", () => {
    const path = submissionObjectPath("abc", "application/pdf");
    expect(path).toMatch(RANDOM_PDF_PATH);
    expect(path).not.toBe(submissionObjectPath("abc", "application/pdf"));
  });
});

describe("the board", () => {
  test("every editor move is a transition the database allows", () => {
    const allowed = new Set(
      [...journalSql.matchAll(TRANSITION_PAIR)].map(([, a, b]) => `${a}>${b}`)
    );
    for (const [from, targets] of Object.entries(editorMoves)) {
      for (const to of targets ?? []) {
        expect(allowed.has(`${from}>${to}`), `${from} → ${to}`).toBe(true);
      }
    }
  });

  test("editors cannot run intake or decide by dragging", () => {
    expect(canEditorMove("received", "intake_check")).toBe(false);
    expect(canEditorMove("selection", "accepted")).toBe(false);
    expect(canEditorMove("in_review", "selection")).toBe(true);
  });

  test("averages ignore reads not yet scored", () => {
    expect(averageTotal([])).toBeNull();
    expect(averageTotal([null, undefined])).toBeNull();
    expect(averageTotal([80, null, 71])).toBe(75.5);
  });
});

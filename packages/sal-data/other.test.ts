import { describe, expect, test } from "vitest";
import { ledgerEntrySchema } from "./charity";
import { ballotSchema, needsCouncilVote } from "./governance";
import { profileSchema, wordCount } from "./membership";
import { sixWordsSchema } from "./programmes";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe("schemas", () => {
  test("cash is counted by two different people", () => {
    const entry = {
      amount_iqd: 50_000,
      campaign_id: id(1),
      counted_by: id(2),
      counted_with: id(2),
      occurred_on: "2026-10-13",
      source: "table_cash",
    };
    expect(ledgerEntrySchema.safeParse(entry).success).toBe(false);
    expect(
      ledgerEntrySchema.safeParse({ ...entry, counted_with: id(3) }).success
    ).toBe(true);
  });

  test("bios are at most 50 words", () => {
    const base = {
      camera_shy: false,
      full_name_en: "A",
      locale: "en",
      notify_email: true,
    };
    expect(
      profileSchema.safeParse({ ...base, bio: "word ".repeat(50) }).success
    ).toBe(true);
    expect(
      profileSchema.safeParse({ ...base, bio: "word ".repeat(51) }).success
    ).toBe(false);
  });

  test("six words are six words", () => {
    expect(wordCount("  The paper waited for the pen ")).toBe(6);
    expect(
      sixWordsSchema.safeParse({
        language: "en",
        text: "Only five words are here",
      }).success
    ).toBe(false);
  });

  test("a ballot ranks each choice once", () => {
    expect(ballotSchema.safeParse({ [id(1)]: [id(2), "RON"] }).success).toBe(
      true
    );
    expect(ballotSchema.safeParse({ [id(1)]: [id(2), id(2)] }).success).toBe(
      false
    );
  });

  test("Council vote above 250,000 IQD", () => {
    expect(needsCouncilVote(250_000)).toBe(false);
    expect(needsCouncilVote(250_001)).toBe(true);
  });
});

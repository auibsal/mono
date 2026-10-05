import { describe, expect, test } from "vitest";
import { ledgerEntrySchema } from "./charity";
import { announcementSchema, newsSchema, pageSchema } from "./content";
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

describe("content schemas match the database", () => {
  const news = {
    cover_path: null,
    programme_id: null,
    publish_at: null,
    slug: "charter-night",
    status: "draft" as const,
    title_ar: "ليلة الميثاق",
    title_en: "Charter Night",
  };

  test("scheduled news needs a publish time", () => {
    expect(newsSchema.safeParse(news).success).toBe(true);
    expect(newsSchema.safeParse({ ...news, status: "scheduled" }).success).toBe(
      false
    );
  });

  test("page slugs may nest; news slugs may not", () => {
    const page = {
      slug: "about/traditions",
      status: "draft" as const,
      title_ar: "تقاليد",
      title_en: "Traditions",
    };
    expect(pageSchema.safeParse(page).success).toBe(true);
    expect(newsSchema.safeParse({ ...news, slug: "a/b" }).success).toBe(false);
  });

  test("a banner is always public, as the table requires", () => {
    const a = {
      audience: "members" as const,
      ends_at: null,
      is_banner: true,
      link: null,
      starts_at: "2026-10-05T09:00:00.000Z",
      title_ar: "تنبيه",
      title_en: "Notice",
    };
    expect(announcementSchema.safeParse(a).success).toBe(false);
    expect(
      announcementSchema.safeParse({ ...a, audience: "public" }).success
    ).toBe(true);
  });
});

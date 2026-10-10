// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { pageBodies } = await import("@/lib/notion/blocks");
const { createNotion, bareId } = await import("@/lib/notion/client");
const { slugify, toInstant } = await import("@/lib/notion/props");
const { checkEvent, checkNews } = await import("@/lib/notion/rules");

const rt = (content: string, extra: object = {}) => ({
  plain_text: content,
  ...extra,
});
const block = (type: string, content: string, extra: object = {}) => ({
  id: content,
  type,
  [type]: { rich_text: [rt(content, extra)] },
});

type Props = Record<string, object>;
const page = (properties: Props) => ({
  id: "11111111-2222-3333-4444-555555555555",
  last_edited_time: "2026-10-10T10:00:00.000Z",
  object: "page" as const,
  properties: properties as never,
});
const title = (value: string) => ({ title: [rt(value)], type: "title" });
const text = (value: string) => ({ rich_text: [rt(value)], type: "rich_text" });
const when = (start: string, end: string | null = null) => ({
  date: { end, start },
  type: "date",
});

describe("Notion page text", () => {
  test("splits English and Arabic under their headings, with formatting", () => {
    const { ar, en } = pageBodies([
      block("heading_2", "English"),
      block("paragraph", "Bring a poem", { annotations: { bold: true } }),
      block("bulleted_list_item", "one"),
      block("bulleted_list_item", "two"),
      block("heading_2", "العربية"),
      block("paragraph", "أحضر قصيدة"),
    ] as never);
    expect(en).toBe(
      "<p><strong>Bring a poem</strong></p><ul><li>one</li><li>two</li></ul>"
    );
    expect(ar).toBe("<p>أحضر قصيدة</p>");
  });

  test("escapes HTML and keeps only web links", () => {
    const { en } = pageBodies([
      block("paragraph", "<script>x</script>", { href: "javascript:alert(1)" }),
      block("paragraph", "site", { href: "https://auibsal.org" }),
    ] as never);
    expect(en).toBe(
      '<p>&lt;script&gt;x&lt;/script&gt;</p><p><a href="https://auibsal.org">site</a></p>'
    );
  });
});

describe("Notion values", () => {
  test("times without an offset are Baghdad time; dates alone are not instants", () => {
    expect(toInstant("2026-10-20T18:00:00.000+03:00")).toBe(
      "2026-10-20T15:00:00.000Z"
    );
    expect(toInstant("2026-10-20T18:00:00")).toBe("2026-10-20T15:00:00.000Z");
    expect(toInstant("2026-10-20")).toBeNull();
  });

  test("slugs are Latin letters, digits and hyphens", () => {
    expect(slugify("Bad Poetry Night: Fall 2026!")).toBe(
      "bad-poetry-night-fall-2026"
    );
    expect(slugify("أمسية الشعر")).toBe("");
    expect(bareId("11111111-2222-3333-4444-555555555555")).toBe(
      "11111111222233334444555555555555"
    );
  });
});

describe("publishing rules", () => {
  const programmes = new Map([["aaaaaaaabbbbccccddddeeeeeeeeeeee", "prog-1"]]);

  test("a complete event passes, with its program mapped to the Nexus", () => {
    const result = checkEvent(
      page({
        Capacity: { number: 40, type: "number" },
        Program: {
          relation: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }],
          type: "relation",
        },
        Summary: text("Bring a poem."),
        "Summary (Arabic)": text("أحضر قصيدة."),
        Title: title("Open Pages"),
        "Title (Arabic)": text("صفحات مفتوحة"),
        When: when(
          "2026-10-20T18:00:00.000+03:00",
          "2026-10-20T20:00:00.000+03:00"
        ),
      }),
      programmes
    );
    expect(result).toMatchObject({
      ok: true,
      values: {
        capacity: 40,
        ends_at: "2026-10-20T17:00:00.000Z",
        programme_id: "prog-1",
        slug: "open-pages",
        starts_at: "2026-10-20T15:00:00.000Z",
      },
    });
  });

  test("an event without Arabic or a start time says what to fix", () => {
    const result = checkEvent(
      page({
        Summary: text("Bring a poem."),
        Title: title("أمسية"),
        When: when("2026-10-20"),
      }),
      programmes
    );
    expect(result.ok).toBe(false);
    const problems = result.ok ? [] : result.problems;
    expect(problems).toEqual(
      expect.arrayContaining([
        "Add the Arabic title (Title (Arabic)).",
        "Add a start time to When, not only a date.",
        "Add the Arabic summary to match the English one.",
        expect.stringContaining("Set a Slug in Latin letters"),
      ])
    );
  });

  test("a news post dated in the future is scheduled for 9:00 AM Baghdad time", () => {
    const result = checkNews(
      page({
        "Publish on": {
          date: { end: null, start: "2030-01-05" },
          type: "date",
        },
        Title: title("Issue 1 is out"),
        "Title (Arabic)": text("صدر العدد الأول"),
      }),
      programmes
    );
    expect(result).toMatchObject({
      ok: true,
      values: {
        publish_at: "2030-01-05T06:00:00.000Z",
        slug: "issue-1-is-out",
      },
    });
  });
});

describe("Notion client", () => {
  test("waits and retries when Notion is rate limiting", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      calls.push(String(url));
      return Promise.resolve(
        calls.length === 1
          ? new Response("{}", { headers: { "retry-after": "1" }, status: 429 })
          : Response.json({ id: "u1", object: "user" })
      );
    });
    const notion = createNotion("secret_token_for_tests", fetchImpl as never);
    const pending = notion.user("u1");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toMatchObject({ id: "u1" });
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
  });

  test("sends the API version and turns errors into NotionError", async () => {
    const fetchImpl = vi.fn((_url: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["Notion-Version"]).toBe("2026-03-11");
      return Promise.resolve(
        Response.json(
          { code: "object_not_found", message: "Could not find page" },
          { status: 404 }
        )
      );
    });
    const notion = createNotion("secret_token_for_tests", fetchImpl as never);
    await expect(notion.trashPage("p1")).rejects.toMatchObject({
      code: "object_not_found",
      status: 404,
    });
  });
});

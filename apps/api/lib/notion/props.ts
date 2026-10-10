import type { NotionPage, NotionProperty, RichText } from "./client";

// ── Writing: Notion property values ─────────────────────────────────────────

/** Rich text in pieces of at most 2,000 characters (Notion's limit). */
const pieces = (text: string) => {
  const out: { text: { content: string }; type: "text" }[] = [];
  for (let i = 0; i < text.length; i += 2000) {
    out.push({ text: { content: text.slice(i, i + 2000) }, type: "text" });
  }
  return out;
};

export const prop = {
  checkbox: (value: boolean) => ({ checkbox: value }),
  date: (start: string | null, end: string | null = null) => ({
    date: start ? { end, start } : null,
  }),
  email: (value: string | null) => ({ email: value || null }),
  multi: (names: readonly string[]) => ({
    // Commas are not allowed in option names.
    multi_select: names.map((name) => ({ name: name.replaceAll(",", " ") })),
  }),
  number: (value: number | null) => ({ number: value }),
  people: (ids: readonly string[]) => ({
    people: ids.map((id) => ({ id, object: "user" })),
  }),
  relation: (ids: readonly string[]) => ({
    relation: ids.map((id) => ({ id })),
  }),
  select: (name: string | null) => ({ select: name ? { name } : null }),
  text: (value: string | null | undefined) => ({
    rich_text: pieces(value ?? ""),
  }),
  title: (value: string) => ({ title: pieces(value) }),
  url: (value: string | null) => ({ url: value || null }),
};

// ── Reading ─────────────────────────────────────────────────────────────────

const joined = (parts: RichText[] | undefined) =>
  (parts ?? [])
    .map((p) => p.plain_text)
    .join("")
    .trim();

const get = (page: NotionPage, name: string): NotionProperty | undefined =>
  page.properties[name];

export const read = {
  checkbox: (page: NotionPage, name: string) =>
    get(page, name)?.checkbox === true,
  date: (page: NotionPage, name: string) => get(page, name)?.date ?? null,
  files: (page: NotionPage, name: string) =>
    (get(page, name)?.files ?? [])
      .map((f) => ({
        name: f.name,
        url: f.type === "file" ? f.file?.url : f.external?.url,
      }))
      .filter((f): f is { name: string; url: string } => Boolean(f.url)),
  number: (page: NotionPage, name: string) => {
    const value = get(page, name)?.number;
    return typeof value === "number" ? value : null;
  },
  relation: (page: NotionPage, name: string) =>
    (get(page, name)?.relation ?? []).map((r) => r.id),
  select: (page: NotionPage, name: string) =>
    get(page, name)?.select?.name ?? null,
  /** Title or rich text, as plain text. */
  text: (page: NotionPage, name: string) => {
    const p = get(page, name);
    return joined(p?.title ?? p?.rich_text);
  },
  url: (page: NotionPage, name: string) => get(page, name)?.url ?? null,
};

const OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * A Notion date as an instant. Notion returns times with an offset; a time
 * without one is taken as Baghdad time (UTC+3, no daylight saving). A date
 * with no time is not an instant.
 */
export const toInstant = (value: string | null | undefined): string | null => {
  if (!value?.includes("T")) {
    return null;
  }
  const hasOffset = OFFSET.test(value);
  const date = new Date(hasOffset ? value : `${value}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const NOT_SLUG = /[^a-z0-9]+/g;
const EDGES = /^-+|-+$/g;

/** A web address part from a title: Latin letters and digits only. */
export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(NOT_SLUG, "-")
    .replace(EDGES, "")
    .slice(0, 80)
    .replace(EDGES, "");

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

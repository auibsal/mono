import type { NotionBlock, RichText } from "./client";

/**
 * A page's text as HTML, split by language. Officers write under a heading
 * "English" and a heading "العربية" (or "Arabic"); text before either
 * heading counts as English. Paragraphs, headings, lists, quotes and
 * dividers carry over, with bold, italic, underline, strikethrough, code
 * and web links. Anything else (images, embeds, nested blocks) is left out;
 * the result is sanitized again before it is stored.
 */
const ESCAPES: Record<string, string> = {
  "'": "&#39;",
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const ESCAPE = /[&<>"']/g;
const escapeHtml = (text: string) =>
  text.replace(ESCAPE, (c) => ESCAPES[c] ?? c);

const WEB_LINK = /^https?:\/\//i;

const inline = (parts: RichText[]) =>
  parts
    .map((part) => {
      let html = escapeHtml(part.plain_text).replaceAll("\n", "<br>");
      const a = part.annotations ?? {};
      if (a.code) {
        html = `<code>${html}</code>`;
      }
      if (a.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (a.italic) {
        html = `<em>${html}</em>`;
      }
      if (a.underline) {
        html = `<u>${html}</u>`;
      }
      if (a.strikethrough) {
        html = `<s>${html}</s>`;
      }
      if (part.href && WEB_LINK.test(part.href)) {
        html = `<a href="${escapeHtml(part.href)}">${html}</a>`;
      }
      return html;
    })
    .join("");

const textOf = (block: NotionBlock): RichText[] => {
  const body = block[block.type] as { rich_text?: RichText[] } | undefined;
  return body?.rich_text ?? [];
};

const plain = (block: NotionBlock) =>
  textOf(block)
    .map((p) => p.plain_text)
    .join("")
    .trim();

const HEADINGS = new Set(["heading_1", "heading_2", "heading_3"]);
const ENGLISH = /^english$/i;
const ARABIC = /^(arabic|العربية)$/i;

type Lang = "ar" | "en";

/** Which language heading this block is, if it is one. */
const languageHeading = (block: NotionBlock): Lang | null => {
  if (!HEADINGS.has(block.type)) {
    return null;
  }
  const text = plain(block);
  if (ENGLISH.test(text)) {
    return "en";
  }
  return ARABIC.test(text) ? "ar" : null;
};

const LISTS: Record<string, "ol" | "ul"> = {
  bulleted_list_item: "ul",
  numbered_list_item: "ol",
};

const TAGS: Record<string, string> = {
  heading_1: "h2",
  heading_2: "h2",
  heading_3: "h3",
  paragraph: "p",
  quote: "blockquote",
};

const toHtml = (blocks: NotionBlock[]) => {
  const out: string[] = [];
  let list: "ol" | "ul" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const block of blocks) {
    const listTag = LISTS[block.type];
    if (listTag) {
      if (list !== listTag) {
        closeList();
        out.push(`<${listTag}>`);
        list = listTag;
      }
      out.push(`<li>${inline(textOf(block))}</li>`);
      continue;
    }
    closeList();
    if (block.type === "divider") {
      out.push("<hr>");
      continue;
    }
    const tag = TAGS[block.type];
    const html = inline(textOf(block));
    if (tag && html) {
      out.push(`<${tag}>${html}</${tag}>`);
    }
  }
  closeList();
  return out.join("");
};

export const pageBodies = (blocks: NotionBlock[]) => {
  const parts: Record<Lang, NotionBlock[]> = { ar: [], en: [] };
  let current: Lang = "en";
  for (const block of blocks) {
    const heading = languageHeading(block);
    if (heading) {
      current = heading;
      continue;
    }
    parts[current].push(block);
  }
  return { ar: toHtml(parts.ar), en: toHtml(parts.en) };
};

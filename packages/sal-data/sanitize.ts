import sanitizeHtml from "sanitize-html";

/**
 * The one HTML policy for rich text (news, pieces, submissions). Applied
 * when saving and again when rendering. No scripts, styles, iframes or
 * event handlers; links get rel="noopener noreferrer nofollow".
 */
const options: sanitizeHtml.IOptions = {
  allowedAttributes: {
    "*": ["lang", "dir"],
    a: ["href", "title", "lang", "dir", "rel"],
  },
  allowedSchemes: ["https", "mailto"],
  allowedTags: [
    "p",
    "br",
    "hr",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "sup",
    "sub",
    "a",
    "span",
    "figure",
    "figcaption",
    "pre",
    "code",
  ],
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
    }),
  },
};

export const sanitizeRichText = (html: string | null | undefined) =>
  sanitizeHtml(html ?? "", options);

/** Plain text from rich text, for excerpts and search snippets. */
export const toPlainText = (html: string | null | undefined) =>
  sanitizeHtml(html ?? "", { allowedAttributes: {}, allowedTags: [] })
    .replace(/\s+/g, " ")
    .trim();

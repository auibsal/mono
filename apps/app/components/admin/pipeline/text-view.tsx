import { sanitizeRichText } from "@repo/sal-data";

/** Submitted rich text, sanitised again on the way out. */
export const TextView = ({
  html,
  lang,
}: {
  html: string | null;
  lang?: string;
}) =>
  html ? (
    <div
      className="prose max-w-none rounded-card bg-surface-tint p-4"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised with the one rich-text policy
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
      lang={lang}
    />
  ) : null;

/**
 * Presence colors, from the brand palette only (never add a color). Each
 * is legible as a label ground with white text.
 */
const COLORS = [
  "var(--sal-crimson)",
  "var(--sal-ink)",
  "var(--sal-crimson-700)",
  "var(--sal-ink-70)",
] as const;

/** A stable presence color per user, the same in every client. */
export const presenceColor = (userId: string) => {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) % COLORS.length;
  }
  return COLORS[hash] ?? COLORS[0];
};

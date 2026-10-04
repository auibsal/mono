const COLORS = [
  "var(--color-red-500)",
  "var(--color-orange-500)",
  "var(--color-amber-500)",
  "var(--color-lime-500)",
  "var(--color-emerald-500)",
  "var(--color-teal-500)",
  "var(--color-sky-500)",
  "var(--color-indigo-500)",
  "var(--color-violet-500)",
  "var(--color-fuchsia-500)",
  "var(--color-rose-500)",
];

/** A stable cursor/avatar color per user, the same in every client. */
export const presenceColor = (userId: string) => {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) % COLORS.length;
  }
  return COLORS[hash] ?? "var(--color-sky-500)";
};

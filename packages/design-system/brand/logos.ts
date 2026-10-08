/**
 * The SAL v4 logo files, used exactly as supplied in brand/logos and copied
 * byte-for-byte to each app's public/brand (tokens.test.ts checks). Never
 * redrawn, recolored or rebuilt in code. The light files are for white,
 * paper and crimson-50 grounds; the reversed files for crimson and ink.
 */
interface LogoFile {
  /** Width ÷ height, from the file's viewBox. */
  readonly aspect: number;
  readonly onDark: string;
  readonly onLight: string;
}

export const logos = {
  /** Anything public: the homepage hero, calls, certificates. */
  bilingual: {
    aspect: 3290.11 / 1099.22,
    onDark: "/brand/sal-lockup-bilingual-reversed.svg",
    onLight: "/brand/sal-lockup-bilingual.svg",
  },
  /** The default: headers, covers, letterheads. */
  horizontal: {
    aspect: 2017.86 / 1009,
    onDark: "/brand/sal-lockup-horizontal-reversed.svg",
    onLight: "/brand/sal-lockup-horizontal.svg",
  },
  /** Square spaces, stickers and merchandise. */
  stacked: {
    aspect: 997.8 / 1857.19,
    onDark: "/brand/sal-lockup-stacked-reversed.svg",
    onLight: "/brand/sal-lockup-stacked.svg",
  },
  /** The symbol alone, once the name appears elsewhere (24 px tall minimum). */
  symbol: {
    aspect: 864 / 1039,
    onDark: "/brand/sal-symbol-white.svg",
    onLight: "/brand/sal-symbol.svg",
  },
} as const satisfies Record<string, LogoFile>;

export type LogoVariant = keyof typeof logos;

/** Every file in brand/logos, as published under public/brand. */
export const logoFiles = [
  "sal-avatar.svg",
  "sal-lockup-bilingual-reversed.svg",
  "sal-lockup-bilingual.svg",
  "sal-lockup-horizontal-reversed.svg",
  "sal-lockup-horizontal.svg",
  "sal-lockup-stacked-reversed.svg",
  "sal-lockup-stacked.svg",
  "sal-symbol-white.svg",
  "sal-symbol.svg",
  "sal-wordmark-ar-reversed.svg",
  "sal-wordmark-ar.svg",
  "sal-wordmark-en-reversed.svg",
  "sal-wordmark-en.svg",
] as const;

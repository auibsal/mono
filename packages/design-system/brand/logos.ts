/**
 * The SAL v4 logo files, used exactly as supplied in brand/logos (copied to
 * each app's public/brand). Never redrawn, recoloured or rebuilt in code.
 *
 * The SVGs are not in the repo yet (see PROGRESS.md). Until they are,
 * `installed` stays false and BrandLogo prints the Society's name in plain
 * type instead of a mark. Fill in the file names from brand/logos/README.
 */
export const logos = {
  /** Homepage hero and calls: bilingual lockup. */
  bilingual: {
    onDark: "/brand/TODO-bilingual-reversed.svg",
    onLight: "/brand/TODO-bilingual.svg",
  },
  /** Header: horizontal lockup. */
  horizontal: {
    onDark: "/brand/TODO-horizontal-reversed.svg",
    onLight: "/brand/TODO-horizontal.svg",
  },
  installed: false as boolean,
  /** Favicon, app icon, social avatar. */
  symbol: {
    onDark: "/brand/TODO-symbol-reversed.svg",
    onLight: "/brand/sal-avatar.svg",
  },
} as const;

export type LogoVariant = "horizontal" | "bilingual" | "symbol";

import { project } from "@repo/config";
import { type LogoVariant, logos } from "../brand/logos";
import { cn } from "../lib/utils";

interface BrandLogoProps {
  readonly className?: string;
  /** "dark" on crimson or ink grounds: uses the reversed file. */
  readonly ground?: "light" | "dark";
  /** Rendered height in pixels (the width follows the file's proportions). */
  readonly height?: number;
  readonly locale?: string;
  readonly variant?: LogoVariant;
}

/**
 * The SAL logo from brand/logos, exactly as supplied: an <img> of the SVG,
 * never redrawn. The alt text is the Society's name in the page language.
 */
export const BrandLogo = ({
  className,
  ground = "light",
  height = 40,
  locale = "en",
  variant = "horizontal",
}: BrandLogoProps) => {
  const file = logos[variant];
  return (
    // biome-ignore lint/performance/noImgElement: SVG logo, served as supplied
    <img
      alt={locale === "ar" ? project.nameAr : project.name}
      className={cn("block w-auto", className)}
      height={height}
      src={ground === "dark" ? file.onDark : file.onLight}
      style={{ height }}
      width={Math.round(height * file.aspect)}
    />
  );
};

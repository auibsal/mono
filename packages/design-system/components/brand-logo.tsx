import { project } from "@repo/config";
import { type LogoVariant, logos } from "../brand/logos";
import { cn } from "../lib/utils";

interface BrandLogoProps {
  readonly className?: string;
  /** "dark" on crimson or ink grounds: uses the reversed file. */
  readonly ground?: "light" | "dark";
  readonly locale?: string;
  readonly variant?: LogoVariant;
}

/**
 * The SAL logo from brand/logos, exactly as supplied. Until the files are
 * installed it prints the Society's name instead (never a drawn imitation).
 */
export const BrandLogo = ({
  className,
  ground = "light",
  locale = "en",
  variant = "horizontal",
}: BrandLogoProps) => {
  const name = locale === "ar" ? project.nameAr : project.name;

  if (!logos.installed) {
    return (
      <span
        className={cn("inline-flex items-baseline gap-2 font-bold", className)}
      >
        <span>{project.shortName}</span>
        <span className="font-normal text-sm">{name}</span>
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: SVG logo, served as-is
    <img
      alt={name}
      className={cn("h-8 w-auto", className)}
      height={32}
      src={logos[variant][ground === "dark" ? "onDark" : "onLight"]}
      width={160}
    />
  );
};

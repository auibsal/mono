import { project } from "@repo/config";
import { cn } from "../lib/utils";

interface BrandLogoProps {
  readonly className?: string;
  readonly showName?: boolean;
}

/**
 * Placeholder brand mark. Replace the SVG with the organization's logo; every
 * app renders the brand through this component.
 */
export const BrandLogo = ({ className, showName = true }: BrandLogoProps) => (
  <span className={cn("inline-flex items-center gap-2", className)}>
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="currentColor" height="24" rx="6" width="24" />
      <path
        d="M7 12h10M12 7v10"
        stroke="var(--background)"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
    {showName ? (
      <span className="whitespace-nowrap font-semibold">{project.name}</span>
    ) : null}
  </span>
);

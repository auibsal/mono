import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DocumentFooterProps {
  readonly className?: string;
  /** Document code, e.g. SAL-GOV-01. */
  readonly code: string;
  /** Right-hand slot: on paper "3 / 14"; on the web, the version or a link. */
  readonly end?: ReactNode;
  /** The short title, e.g. "Constitution". */
  readonly title: string;
}

/**
 * The brand's Document Footer (brand/components/DocumentFooter): code and
 * title in Ubuntu Mono at the start, a slot at the end, in text-meta (which
 * turns Crimson 100 on ink pages).
 */
export const DocumentFooter = ({
  className,
  code,
  end,
  title,
}: DocumentFooterProps) => (
  <footer
    className={cn(
      "flex flex-wrap items-baseline justify-between gap-gap border-rule border-t pt-4 text-sm text-text-meta",
      className
    )}
  >
    <span className="type-code">
      {code} · {title}
    </span>
    {end ? <span className="tabular-nums">{end}</span> : null}
  </footer>
);

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DocumentHeaderProps {
  readonly children?: ReactNode;
  readonly className?: string;
  /** Document code in Ubuntu Mono, e.g. SAL-GOV-01. */
  readonly code?: string;
  /** The document's Arabic name, under the code as on the printed cover. */
  readonly nameAr?: string;
  /** One sentence, in the Lede style. */
  readonly subtitle?: string;
  readonly title: string;
}

/**
 * The brand's Document Cover (brand/components/DocumentCover), adapted for
 * the web: the code and Arabic name at the top end, the title in Display in
 * ink (not crimson: crimson Display is for section titles), then the
 * subtitle. The site header carries the lockup, so it is not repeated here.
 * Always light.
 */
export const DocumentHeader = ({
  children,
  className,
  code,
  nameAr,
  subtitle,
  title,
}: DocumentHeaderProps) => (
  <header className={cn("grid gap-6", className)} data-theme="light">
    {code || nameAr ? (
      <div className="grid justify-items-end text-end text-text-meta">
        {code ? (
          <p className="type-code text-sm tracking-wide">{code}</p>
        ) : null}
        {nameAr ? (
          <p className="text-sm" dir="rtl" lang="ar">
            {nameAr}
          </p>
        ) : null}
      </div>
    ) : null}
    <h1 className="type-display text-text">{title}</h1>
    {subtitle ? (
      <p className="type-lede max-w-3xl text-text">{subtitle}</p>
    ) : null}
    {children}
  </header>
);

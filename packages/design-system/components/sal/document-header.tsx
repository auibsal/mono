import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DocumentHeaderProps {
  readonly children?: ReactNode;
  readonly className?: string;
  /** Document code in Ubuntu Mono, e.g. SAL-GOV-01. */
  readonly code?: string;
  readonly titleAr?: string;
  readonly titleEn: string;
  readonly version?: string;
}

/**
 * Web adaptation of the brand's Document Cover: code (Ubuntu Mono), English
 * title and the Arabic name, as on the printed cover. INTERIM layout until
 * brand/components is in the repo.
 */
export const DocumentHeader = ({
  children,
  className,
  code,
  titleAr,
  titleEn,
  version,
}: DocumentHeaderProps) => (
  <header
    className={cn("grid gap-3 border-accent-line border-b pb-6", className)}
  >
    {code ? (
      <p className="type-code text-text-meta">
        <span>{code}</span>
        {version ? <span> · v{version}</span> : null}
      </p>
    ) : null}
    <h1 className="type-display">{titleEn}</h1>
    {titleAr ? (
      <p className="type-heading text-text" dir="rtl" lang="ar">
        {titleAr}
      </p>
    ) : null}
    {children}
  </header>
);

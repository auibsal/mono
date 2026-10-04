import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DocumentFooterProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly code?: string;
  readonly motto?: string;
}

/** The brand's Document Footer: code, motto and a rule. INTERIM layout. */
export const DocumentFooter = ({
  children,
  className,
  code,
  motto,
}: DocumentFooterProps) => (
  <footer
    className={cn(
      "type-caption mt-12 grid gap-2 border-rule border-t pt-4",
      className
    )}
  >
    {children}
    <p className="flex flex-wrap justify-between gap-2">
      {code ? <span className="type-code">{code}</span> : null}
      {motto ? <span>{motto}</span> : null}
    </p>
  </footer>
);

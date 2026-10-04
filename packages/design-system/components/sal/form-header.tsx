import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface FormHeaderProps {
  readonly children?: ReactNode;
  readonly className?: string;
  /** Small label above the title, e.g. the form's document code. */
  readonly kicker?: string;
  readonly title: string;
}

/**
 * The top of every Nexus form (brand component "Form Header"): kicker,
 * title and an accent hairline. INTERIM layout until the brand book's HTML
 * source (brand/components) is in the repo.
 */
export const FormHeader = ({
  children,
  className,
  kicker,
  title,
}: FormHeaderProps) => (
  <header
    className={cn("grid gap-2 border-accent-line border-b pb-4", className)}
  >
    {kicker ? <p className="type-kicker">{kicker}</p> : null}
    <h1 className="type-heading">{title}</h1>
    {children ? (
      <div className="type-body text-text-secondary">{children}</div>
    ) : null}
  </header>
);

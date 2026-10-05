import type { ReactNode } from "react";
import { logos } from "../../brand/logos";
import { cn } from "../../lib/utils";

interface FormHeaderProps {
  readonly children?: ReactNode;
  readonly className?: string;
  /** The form's code in Ubuntu Mono, e.g. "SAL-OPS-02 · F-14". */
  readonly code?: string;
  readonly title: string;
}

/**
 * The brand's Form Header (brand/components/FormHeader), adapted for screen:
 * the form code in Ubuntu Mono and the title, the symbol at the top end, and
 * a crimson rule at twice the hairline. Forms are always light.
 */
export const FormHeader = ({
  children,
  className,
  code,
  title,
}: FormHeaderProps) => (
  <header className={cn("grid gap-3", className)} data-theme="light">
    <div className="flex items-start justify-between gap-gap border-accent-line border-b-2 pb-gap-tight">
      <div className="grid gap-1.5">
        {code ? (
          <p className="type-code text-sm text-text-secondary">{code}</p>
        ) : null}
        <h1 className="font-bold text-2xl text-text leading-tight">{title}</h1>
      </div>
      {/* biome-ignore lint/performance/noImgElement: SVG symbol, served as supplied */}
      <img
        alt=""
        className="h-10 w-auto flex-none"
        height={40}
        src={logos.symbol.onLight}
        width={Math.round(40 * logos.symbol.aspect)}
      />
    </div>
    {children ? (
      <div className="type-body text-text-secondary">{children}</div>
    ) : null}
  </header>
);

import type { ReactNode } from "react";

interface SectionProps {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly id: string;
  readonly title: string;
}

/** A home section: heading with an optional action, hairline, content. */
export const Section = ({ action, children, id, title }: SectionProps) => (
  <section aria-labelledby={id} className="grid content-start gap-3">
    <div className="flex items-baseline justify-between gap-4 border-rule border-b pb-2">
      <h2 className="type-subheading" id={id}>
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

import type { ReactNode } from "react";

/** A Society page section: heading on a 2px rule, then its content. */
export const SocietySection = ({
  children,
  id,
  lede,
  title,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly lede?: string;
  readonly title: string;
}) => (
  <section aria-labelledby={id} className="grid content-start gap-4">
    <header className="frame-b grid gap-1 pb-2">
      <h2 className="type-heading" id={id}>
        {title}
      </h2>
      {lede ? <p className="type-body text-text-secondary">{lede}</p> : null}
    </header>
    {children}
  </section>
);

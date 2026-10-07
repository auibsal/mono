import type { ReactNode } from "react";

/** A page section with the accent-ruled heading used across the site. */
export const Section = ({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) => (
  <section aria-labelledby={id} className="grid gap-4">
    <h2 className="type-heading border-accent-line border-b pb-2" id={id}>
      {title}
    </h2>
    {children}
  </section>
);

/** A page header: Display title and lede. */
export const PageHeader = ({
  children,
  lede,
  title,
}: {
  children?: ReactNode;
  lede: string;
  title: string;
}) => (
  <header className="grid gap-4">
    <h1 className="type-display">{title}</h1>
    <p className="type-lede max-w-3xl">{lede}</p>
    {children}
  </header>
);

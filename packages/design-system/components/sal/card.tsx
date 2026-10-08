import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * SAL card (v5 Screens): surface-tint ground, square, a 2px frame. Add
 * `shadow-offset` for a card that is a single action or feature.
 */
export const SalCard = ({ className, ...props }: ComponentProps<"section">) => (
  <section
    className={cn("frame grid gap-3 bg-surface-tint p-card-padding", className)}
    {...props}
  />
);

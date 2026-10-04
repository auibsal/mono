import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** SAL card: surface-tint ground, 8px radius, no shadow, no border. */
export const SalCard = ({ className, ...props }: ComponentProps<"section">) => (
  <section
    className={cn("grid gap-3 rounded-card bg-surface-tint p-5", className)}
    {...props}
  />
);

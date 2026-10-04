import { createNavigation } from "next-intl/navigation";
import type {} from "./augment";
import { routing } from "./routing";

/** Locale-aware Link, redirect and router hooks. */
export const { getPathname, Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

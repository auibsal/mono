"use client";

import { useSearchParams } from "next/navigation";

/**
 * Record ids travel in the query string (?id=…), because the Nexus is a
 * static export with one prerendered page per route.
 */
export const useQueryParam = (name: string) =>
  useSearchParams().get(name) ?? null;

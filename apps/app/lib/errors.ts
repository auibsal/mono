/** Postgres error codes returned by Supabase for SAL tables and RPCs. */
export const errorCodes = {
  checkViolation: "23514",
  insufficientPrivilege: "42501",
  invalidParameter: "22023",
  noDataFound: "P0002",
  rateLimited: "54000",
  uniqueViolation: "23505",
} as const;

export const codeOf = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;

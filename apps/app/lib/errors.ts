/** Postgres error codes returned by Supabase for our tables and RPCs. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const STRING_TOO_LONG = "22001";
const NO_DATA_FOUND = "P0002";
const INSUFFICIENT_PRIVILEGE = "42501";

const codeOf = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;

export type OrganizationError = "slugInvalid" | "slugTaken" | "unknown";

/** Creating or renaming an organization (unique, valid slug). */
export const toOrganizationError = (error: unknown): OrganizationError => {
  switch (codeOf(error)) {
    case UNIQUE_VIOLATION:
      return "slugTaken";
    case CHECK_VIOLATION:
    case STRING_TOO_LONG:
      return "slugInvalid";
    default:
      return "unknown";
  }
};

export type InvitationError = "expired" | "unknown" | "wrongAccount";

/** accept_invitation(): expired/used, or addressed to someone else. */
export const toInvitationError = (error: unknown): InvitationError => {
  switch (codeOf(error)) {
    case NO_DATA_FOUND:
      return "expired";
    case INSUFFICIENT_PRIVILEGE:
      return "wrongAccount";
    default:
      return "unknown";
  }
};

import "server-only";

import type { Permission } from "@repo/rbac";
import { membership } from "@repo/sal-data";
import type { ApiSession } from "./permissions";

/**
 * CSV exports for the Nexus admin. Each one runs as the caller (their JWT),
 * so Row Level Security and the SQL functions decide the rows; the
 * permission here is re-checked first, in any scope.
 */
export interface ExportDefinition {
  readonly header: readonly string[];
  readonly permissions: readonly Permission[];
  readonly rows: (
    session: ApiSession,
    params: Record<string, string>
  ) => Promise<unknown[][]>;
}

export const exportsByName: Record<string, ExportDefinition> = {
  members: {
    header: [
      "name_en",
      "name_ar",
      "email",
      "tier",
      "member_since",
      "verified",
      "activities_this_and_last_semester",
      "voting_member",
    ],
    permissions: ["members.manage", "members.verify", "roles.assign"],
    rows: async (session) =>
      (await membership.directory(session.supabase)).map((m) => [
        m.full_name_en,
        m.full_name_ar,
        m.email,
        m.tier,
        m.member_since,
        m.verified_at ? "yes" : "no",
        m.activities,
        m.voting_member ? "yes" : "no",
      ]),
  },
};

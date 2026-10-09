import { scopeTypes } from "@repo/rbac";
import { z } from "zod";
import { type Client, unwrap } from "./client";

/** access.assign_role(): roles.assign is re-checked in the database. */
export const roleAssignmentSchema = z
  .object({
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    /** An adopted Council resolution agreeing to a B5.5 exception. */
    exception_resolution: z.uuid().nullable().optional(),
    note: z.string().trim().max(500).optional(),
    role_key: z.string().regex(/^[a-z_]+$/),
    scope_id: z.uuid().nullable(),
    scope_type: z.enum(scopeTypes),
    starts_at: z.iso.datetime({ offset: true }),
    target_user: z.uuid(),
    title_ar: z.string().trim().max(120).optional(),
    title_en: z.string().trim().max(120).optional(),
  })
  .refine((a) => (a.scope_type === "global") === (a.scope_id === null), {
    message: "scope_id",
    path: ["scope_id"],
  })
  .refine((a) => !a.ends_at || new Date(a.ends_at) > new Date(a.starts_at), {
    message: "ends_before_start",
    path: ["ends_at"],
  });

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;

/**
 * The rules access.assign_role enforces (Constitution 6.6 and 9.1, Bylaws
 * B5.5 and B9.8), as the reason codes it raises.
 */
export const roleRules = [
  "already_holds_role",
  "one_council_seat",
  "advisor_holds_no_other_role",
  "two_roles_at_most",
  "one_leadership_role",
  "exception_needs_adopted_resolution",
] as const;

export type RoleRule = (typeof roleRules)[number];

/** The rule an assignment broke, from the database error, if any. */
export const brokenRoleRule = (error: unknown): RoleRule | null => {
  const message = error instanceof Error ? error.message : "";
  return roleRules.find((rule) => message === rule) ?? null;
};

export const assignRole = async (
  client: Client,
  input: RoleAssignmentInput
) => {
  const a = roleAssignmentSchema.parse(input);
  return unwrap(
    await client.schema("access").rpc("assign_role", {
      ends_at: a.ends_at ?? undefined,
      exception_resolution: a.exception_resolution ?? undefined,
      note: a.note || undefined,
      role_key: a.role_key,
      scope_id: a.scope_id ?? undefined,
      scope_type: a.scope_type,
      starts_at: a.starts_at,
      target_user: a.target_user,
      title_ar: a.title_ar || undefined,
      title_en: a.title_en || undefined,
    })
  );
};

export const endRoleAssignment = async (client: Client, assignmentId: string) =>
  unwrap(
    await client
      .schema("access")
      .rpc("end_role_assignment", { assignment_id: assignmentId })
  );

export const roles = async (client: Client) =>
  unwrap(
    await client
      .schema("access")
      .from("roles")
      .select("key, name_en, name_ar, is_council, sort")
      .order("sort")
  ) ?? [];

/** A member's assignments, past and present (roles.assign holders see all). */
export const assignmentsFor = async (client: Client, userId: string) =>
  unwrap(
    await client
      .schema("access")
      .from("role_assignments")
      .select(
        "id, role, scope_type, scope_id, title_en, title_ar, starts_at, ends_at, note, created_at"
      )
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
  ) ?? [];

/** Active now: started and not yet ended. */
export const isActiveAssignment = (
  a: { ends_at: string | null; starts_at: string },
  now = new Date()
) =>
  new Date(a.starts_at) <= now &&
  (a.ends_at === null || new Date(a.ends_at) > now);

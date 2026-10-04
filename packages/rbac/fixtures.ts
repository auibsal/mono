import type { Role } from "./roles";

/**
 * Test personas shared by pgTAP fixtures, unit tests and e2e seeds. Ids are
 * stable so tests can refer to them; emails are on the AUIB domain unless
 * the persona is meant to be unverified.
 */
export interface Persona {
  email: string;
  id: string;
  name: string;
  roles: { role: Role; scope?: "issue" | "programme" | "campaign" }[];
}

export const personas = {
  editor: {
    email: "eic@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000005e1",
    name: "Editor",
    roles: [{ role: "eic", scope: "issue" }],
  },
  founder: {
    email: "founder@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000000f1",
    name: "Founder",
    roles: [{ role: "president" }],
  },
  guest: {
    email: "guest@gmail.com",
    id: "00000000-0000-0000-0000-0000000000b1",
    name: "Guest",
    roles: [],
  },
  member: {
    email: "member@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000000a1",
    name: "Member",
    roles: [],
  },
  reader: {
    email: "r1@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000005b1",
    name: "Reader One",
    roles: [{ role: "reader", scope: "issue" }],
  },
  submissionsManager: {
    email: "sm@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000005a1",
    name: "Submissions Manager",
    roles: [{ role: "submissions_manager", scope: "issue" }],
  },
  treasurer: {
    email: "treasurer@auib.edu.iq",
    id: "00000000-0000-0000-0000-0000000000d2",
    name: "Treasurer",
    roles: [{ role: "treasurer" }],
  },
} as const satisfies Record<string, Persona>;

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * SQL that creates the personas (run as the superuser in a test
 * transaction). Scoped roles use the given scope id.
 */
export const personasSql = (
  scopeIds: Partial<Record<"issue" | "programme" | "campaign", string>> = {}
) =>
  Object.values(personas)
    .flatMap((persona: Persona) => [
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values (${quote(persona.id)}, ${quote(persona.email)}, now(), jsonb_build_object('full_name_en', ${quote(persona.name)}), 'authenticated', 'authenticated');`,
      ...persona.roles.map(({ role, scope }) =>
        scope
          ? `insert into access.role_assignments (user_id, role, scope_type, scope_id) values (${quote(persona.id)}, ${quote(role)}, ${quote(scope)}, ${quote(scopeIds[scope] ?? "")});`
          : `insert into access.role_assignments (user_id, role) values (${quote(persona.id)}, ${quote(role)});`
      ),
    ])
    .join("\n");

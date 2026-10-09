/**
 * Permission keys. The database is the source of truth
 * (packages/database/supabase/migrations/*_reference_data.sql); rbac.test.ts
 * fails if this list drifts from it. Code checks these keys, never role names.
 */
export const permissions = [
  "members.verify",
  "members.manage",
  "roles.assign",
  "events.manage",
  "events.checkin",
  "content.manage",
  "journal.manage",
  "journal.review",
  "journal.advise",
  "journal.identity.view",
  "journal.decide",
  "journal.publish",
  "charity.manage",
  "charity.ledger.write",
  "charity.ledger.signoff",
  "programmes.manage",
  "governance.manage",
  "governance.minutes.write",
  "elections.manage",
  "library.read",
  "library.council",
  "audit.read",
  "settings.manage",
  "spending.request",
  "spending.countersign",
  "partners.manage",
  "partners.sign",
] as const;

export type Permission = (typeof permissions)[number];

export const scopeTypes = ["global", "programme", "issue", "campaign"] as const;

export type ScopeType = (typeof scopeTypes)[number];

export const isPermission = (value: string): value is Permission =>
  (permissions as readonly string[]).includes(value);

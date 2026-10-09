import type { Permission } from "./permissions";

/**
 * Nexus admin modules and the permission (held in any scope) that shows
 * each one. Pages still scope their rows by program, issue or campaign.
 */
export const adminModules = [
  {
    key: "overview",
    permissions: [
      "members.manage",
      "events.manage",
      "journal.manage",
      "charity.manage",
    ],
  },
  {
    key: "members",
    permissions: ["members.verify", "members.manage", "roles.assign"],
  },
  { key: "events", permissions: ["events.manage", "events.checkin"] },
  { key: "journal", permissions: ["journal.publish"] },
  {
    key: "pipeline",
    permissions: [
      "journal.manage",
      "journal.review",
      "journal.identity.view",
      "journal.decide",
      "journal.advise",
    ],
  },
  { key: "content", permissions: ["content.manage"] },
  {
    key: "charity",
    permissions: [
      "charity.manage",
      "charity.ledger.write",
      "charity.ledger.signoff",
    ],
  },
  { key: "programs", permissions: ["programmes.manage"] },
  { key: "partners", permissions: ["partners.manage", "partners.sign"] },
  {
    key: "governance",
    permissions: [
      "governance.manage",
      "governance.minutes.write",
      "elections.manage",
      "spending.request",
      "spending.countersign",
    ],
  },
  { key: "activity", permissions: ["audit.read"] },
  { key: "settings", permissions: ["settings.manage"] },
] as const satisfies readonly {
  key: string;
  permissions: readonly Permission[];
}[];

export type AdminModule = (typeof adminModules)[number]["key"];

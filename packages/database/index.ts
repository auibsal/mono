/**
 * Database types, safe to import from client and server code. The privileged
 * client lives in `@repo/database/admin` (server-only).
 */
export {
  Constants,
  type Database,
  type Enums,
  type Json,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from "./types";

/** Schemas exposed through the Data API (PostgREST). */
export const schemas = [
  "core",
  "access",
  "membership",
  "events",
  "journal",
  "charity",
  "programmes",
  "governance",
  "content",
] as const;

export type Schema = (typeof schemas)[number];

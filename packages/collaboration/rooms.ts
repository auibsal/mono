import type { Permission, ScopeType } from "@repo/rbac";

/**
 * Collaboration rooms. A room id names one record that people co-edit:
 * `sal:<kind>:<uuid>`. apps/api authorizes a room only after reading the
 * record as the caller (RLS) and re-checking the permission below, so a room
 * never opens for someone who could not open the record itself.
 *
 * Journal submissions under blind review never get a room: identities must
 * not travel through presence. Only accepted pieces are co-edited.
 */
export const roomKinds = {
  /** Draft minutes (General Secretary and Council). */
  minutes: {
    permission: "governance.minutes.write",
    scope: "global",
    table: { name: "minutes", schema: "governance" },
  },
  /** News posts. */
  news: {
    permission: "content.manage",
    scope: "global",
    table: { name: "news_posts", schema: "content" },
  },
  /** Site pages. */
  page: {
    permission: "content.manage",
    scope: "global",
    table: { name: "pages", schema: "content" },
  },
  /** Accepted Journal pieces, copy-edited by the issue's masthead. */
  piece: {
    permission: "journal.publish",
    scope: "issue",
    scopeColumn: "issue_id",
    table: { name: "pieces", schema: "journal" },
  },
} as const satisfies Record<
  string,
  {
    permission: Permission;
    scope: ScopeType;
    scopeColumn?: string;
    table: { name: string; schema: string };
  }
>;

export type RoomKind = keyof typeof roomKinds;

const ROOM =
  /^sal:([a-z]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export const roomId = (kind: RoomKind, id: string) => `sal:${kind}:${id}`;

/** Parses a room id; null for anything that is not a known kind and uuid. */
export const parseRoom = (room: string) => {
  const match = ROOM.exec(room);
  const kind = match?.[1];
  const id = match?.[2];
  if (!(kind && id && Object.hasOwn(roomKinds, kind))) {
    return null;
  }
  return { id, kind: kind as RoomKind, ...roomKinds[kind as RoomKind] };
};

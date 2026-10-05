import "server-only";
import { Liveblocks as LiveblocksNode } from "@liveblocks/node";
import { presenceColor } from "./colors";
// The global Liveblocks types (UserMeta…) are declared in config.ts.
import type {} from "./config";
import { keys } from "./keys";

interface AuthoriseRoomOptions {
  name: string;
  /** The single room this token opens (already checked by the caller). */
  room: string;
  userId: string;
}

export const collaborationEnabled = () => Boolean(keys().LIVEBLOCKS_SECRET);

/**
 * Issues a Liveblocks token for exactly one room, already authorised by
 * apps/api (record readable under RLS and the permission re-checked).
 */
export const authoriseRoom = async ({
  name,
  room,
  userId,
}: AuthoriseRoomOptions) => {
  const secret = keys().LIVEBLOCKS_SECRET;
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET is not set");
  }

  const liveblocks = new LiveblocksNode({ secret });
  const session = liveblocks.prepareSession(userId, {
    userInfo: { color: presenceColor(userId), name },
  });
  session.allow(room, session.FULL_ACCESS);

  const { body, status } = await session.authorize();
  return { body, status };
};

import { authenticateRequest } from "@repo/auth/verify";
import { authoriseRoom, collaborationEnabled } from "@repo/collaboration/auth";
import { parseRoom } from "@repo/collaboration/rooms";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";
import { hasPermission } from "@/lib/permissions";

export const OPTIONS = preflight;

const body = z.object({ room: z.string().max(80) });

/**
 * Liveblocks token for one room (packages/collaboration/rooms.ts). The
 * record must be readable by the caller under RLS, and the room's
 * permission is re-checked here, in the record's scope.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  if (!collaborationEnabled()) {
    return json({ error: "collaboration_disabled" }, 503);
  }

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  const room = parsed.success ? parseRoom(parsed.data.room) : null;
  if (!(parsed.success && room)) {
    return json({ error: "invalid_room" }, 400);
  }

  const scopeColumn = "scopeColumn" in room ? room.scopeColumn : null;
  // biome-ignore lint/suspicious/noExplicitAny: the table is chosen from a fixed list
  const client = session.supabase.schema(room.table.schema as any) as any;
  const { data: record } = await client
    .from(room.table.name)
    .select(scopeColumn ? `id, ${scopeColumn}` : "id")
    .eq("id", room.id)
    .maybeSingle();
  if (!record) {
    return json({ error: "forbidden" }, 403);
  }

  const scopeId = scopeColumn ? (record[scopeColumn] as string | null) : null;
  const allowed = await hasPermission(
    session,
    room.permission,
    scopeId ? room.scope : "global",
    scopeId
  );
  if (!allowed) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: profile } = await session.supabase
    .schema("core")
    .from("profiles")
    .select("full_name_en")
    .eq("id", session.userId)
    .maybeSingle();

  try {
    const token = await authoriseRoom({
      name: profile?.full_name_en || "SAL",
      room: parsed.data.room,
      userId: session.userId,
    });
    return new Response(token.body, {
      headers: { ...headers, "content-type": "application/json" },
      status: token.status,
    });
  } catch (error) {
    log.error(`Collaboration auth failed: ${parseError(error)}`);
    return json({ error: "collaboration_failed" }, 502);
  }
};

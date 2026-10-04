import { authenticateRequest } from "@repo/auth/verify";
import { authenticate } from "@repo/collaboration/auth";
import { presenceColor } from "@repo/collaboration/colors";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";
import { membershipRole } from "@/lib/membership";

// Rooms are named "<organization id>:<room>".
const body = z.object({
  room: z.string().regex(/^[0-9a-f-]{36}:[\w-]{1,100}$/i),
});

export const OPTIONS = preflight;

/**
 * Liveblocks tokens for apps/app (web and native), which can't hold the
 * secret. Members get full access to their organization's rooms.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  const [organizationId = ""] = parsed.data.room.split(":");
  if (!(await membershipRole(session, organizationId))) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: profile } = await session.supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", session.userId)
    .maybeSingle();

  try {
    const response = await authenticate({
      orgId: organizationId,
      userId: session.userId,
      userInfo: {
        avatar: profile?.avatar_url ?? undefined,
        color: presenceColor(session.userId),
        name: profile?.full_name ?? undefined,
      },
    });
    return new Response(response.body, {
      headers: { ...headers, "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (error) {
    log.error(`Collaboration auth failed: ${parseError(error)}`);
    return json({ error: "not_configured" }, 503);
  }
};

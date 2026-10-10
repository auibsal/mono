import { authenticateRequest } from "@repo/auth/verify";
import { parseError } from "@repo/observability/error";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { corsHeaders, preflight } from "@/lib/cors";
import { createNotion } from "@/lib/notion/client";
import { accessLists, homeUrl, readSyncState } from "@/lib/notion/run";
import { hasPermission } from "@/lib/permissions";

export const OPTIONS = preflight;

/**
 * The Notion connection for Administration → Settings: whether it is set
 * up, the last sync, and who to invite to or remove from the workspace.
 * Settings managers and role assigners only.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }
  const [settings, roles] = await Promise.all([
    hasPermission(session, "settings.manage"),
    hasPermission(session, "roles.assign"),
  ]);
  if (!(settings || roles)) {
    return json({ error: "forbidden" }, 403);
  }

  const [state, home] = await Promise.all([readSyncState(), homeUrl()]);
  if (!env.NOTION_TOKEN) {
    return json({ configured: false, home, state });
  }
  try {
    const lists = await accessLists(createNotion(env.NOTION_TOKEN));
    return json({ configured: true, home, state, ...lists });
  } catch (error) {
    return json({
      configured: true,
      home,
      listsError: parseError(error).slice(0, 200),
      state,
    });
  }
};

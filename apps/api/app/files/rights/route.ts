import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { createSignedFileUrl } from "@repo/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";
import { hasPermission } from "@/lib/permissions";

export const OPTIONS = preflight;

const body = z.object({ id: z.uuid() });

/**
 * A five-minute link to a production's rights document (a script license
 * or the author's consent). The caller reads the row with their own JWT
 * (RLS), and must run that production.
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

  const allowed = await hasPermission(
    session,
    "productions.manage",
    "production",
    parsed.data.id
  );
  if (!allowed) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: production } = await session.supabase
    .schema("programmes")
    .from("productions")
    .select("rights_document_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const path = production?.rights_document_path;
  if (!path?.startsWith("productions/")) {
    return json({ error: "not_found" }, 404);
  }

  try {
    const url = await createSignedFileUrl(createAdminClient(), "library", path);
    return json({ url });
  } catch (error) {
    log.error(`Rights document link failed: ${parseError(error)}`);
    return json({ error: "not_found" }, 404);
  }
};

import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";
import { deleteOrganization } from "@/lib/deletion";

const body = z.object({ organizationId: z.uuid() });

export const OPTIONS = preflight;

/** Deletes an organization with its data and files (owners only). */
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

  try {
    const result = await deleteOrganization(
      { admin: createAdminClient(), user: session.supabase },
      parsed.data.organizationId
    );

    if (result.status === "forbidden") {
      return json({ error: "forbidden" }, 403);
    }

    log.info(
      `Organization ${parsed.data.organizationId} deleted by ${session.userId}`
    );
    return json({ ok: true });
  } catch (error) {
    log.error(`Organization deletion failed: ${parseError(error)}`);
    return json({ error: "deletion_failed" }, 500);
  }
};

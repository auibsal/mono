import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { createSignedFileUrl } from "@repo/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";

export const OPTIONS = preflight;

const body = z.object({ id: z.uuid() });

/**
 * A five-minute link to a charity receipt in the private bucket. Public
 * receipts are open to anyone (the transparency page); others only to the
 * campaign's managers, decided by RLS on the caller's own read.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  const admin = createAdminClient();
  const session = await authenticateRequest(request);
  // Signed in: read as the caller, so RLS decides. Otherwise public only.
  const reader = session ? session.supabase : admin;
  let query = reader
    .schema("charity")
    .from("receipts")
    .select("storage_path, is_public")
    .eq("id", parsed.data.id);
  if (!session) {
    query = query.eq("is_public", true);
  }
  const { data: receipt } = await query.maybeSingle();
  if (!receipt) {
    return json({ error: "not_found" }, 404);
  }

  try {
    const url = await createSignedFileUrl(
      admin,
      "receipts",
      receipt.storage_path
    );
    return json({ url });
  } catch (error) {
    log.error(`Receipt link failed: ${parseError(error)}`);
    return json({ error: "not_found" }, 404);
  }
};

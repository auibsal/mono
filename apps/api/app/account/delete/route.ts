import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { corsHeaders, preflight } from "@/lib/cors";
import { deleteAccount } from "@/lib/deletion";

export const OPTIONS = preflight;

/** Permanently deletes the caller's account (Profile and privacy). */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    await deleteAccount(createAdminClient(), session.userId);
    log.info("Account deleted");
    return json({ ok: true });
  } catch (error) {
    log.error(`Account deletion failed: ${parseError(error)}`);
    return json({ error: "deletion_failed" }, 500);
  }
};

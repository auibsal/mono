import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { corsHeaders, preflight } from "@/lib/cors";
import { deleteAccount } from "@/lib/deletion";

export const OPTIONS = preflight;

/**
 * Permanently deletes the caller's account (App Store and Google Play
 * account deletion requirement). Responds 409 with the organizations the
 * caller alone owns when those must be resolved first.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const result = await deleteAccount(
      { admin: createAdminClient(), user: session.supabase },
      session.userId
    );

    if (result.status === "blocked") {
      return json(
        { error: "sole_owner", organizations: result.organizations },
        409
      );
    }

    log.info(`Account ${session.userId} deleted`);
    return json({ ok: true });
  } catch (error) {
    log.error(`Account deletion failed: ${parseError(error)}`);
    return json({ error: "deletion_failed" }, 500);
  }
};

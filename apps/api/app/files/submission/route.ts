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
 * A five-minute link to an original submission file, for its author and
 * the issue's Submissions Manager only: the caller's own read of
 * journal.submission_files decides, under RLS. Readers use /files/blind.
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

  const { data: file } = await session.supabase
    .schema("journal")
    .from("submission_files")
    .select("storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!file) {
    return json({ error: "not_found" }, 404);
  }

  try {
    const url = await createSignedFileUrl(
      createAdminClient(),
      "submissions",
      file.storage_path
    );
    return json({ url });
  } catch (error) {
    log.error(`Submission link failed: ${parseError(error)}`);
    return json({ error: "not_found" }, 404);
  }
};

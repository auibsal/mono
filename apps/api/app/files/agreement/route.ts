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
 * A five-minute link to the signed copy of a partnership memorandum (Form
 * F-26). The caller reads the row with their own JWT, so RLS decides
 * (partnership managers, signers and governance managers only).
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

  const { data: agreement } = await session.supabase
    .schema("governance")
    .from("partner_agreements")
    .select("signed_document_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const path = agreement?.signed_document_path;
  if (!path?.startsWith("partners/")) {
    return json({ error: "not_found" }, 404);
  }

  try {
    const url = await createSignedFileUrl(createAdminClient(), "library", path);
    return json({ url });
  } catch (error) {
    log.error(`Agreement link failed: ${parseError(error)}`);
    return json({ error: "not_found" }, 404);
  }
};

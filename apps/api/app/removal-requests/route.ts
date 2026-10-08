import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { programmes } from "@repo/sal-data";
import { protectForm } from "@repo/security/form";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";

export const OPTIONS = preflight;

const requestSchema = programmes.removalRequestSchema.extend({
  programme: z.enum(["side-quest"]).optional(),
  /** Left empty by people; filled by bots (the form hides it). */
  website: z.string().max(500).optional(),
});

/** At most this many requests per email address per hour. */
const PER_HOUR = 3;

/**
 * Side Quest care (Policy Manual 5.3): anyone may ask for a photo or video of
 * themselves to be removed, and it comes down within 24 hours. No sign-in is
 * needed, so the request is written with the admin client after validation;
 * the database trigger queues the notice to the programme's managers.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (payload: object, status = 200) =>
    NextResponse.json(payload, { headers, status });

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }
  const { programme, website, ...fields } = parsed.data;
  if (website) {
    // Pretend success so the bot learns nothing.
    return json({ ok: true });
  }

  const verdict = await protectForm(request, fields.requester_email);
  if (verdict === "rate_limited") {
    return json({ error: "rate_limited" }, 429);
  }
  if (verdict === "invalid_email") {
    return json({ error: "invalid_email" }, 400);
  }
  if (verdict === "bot") {
    return json({ error: "forbidden" }, 403);
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .schema("programmes")
    .from("removal_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_email", fields.requester_email)
    .gte("created_at", since);
  if ((count ?? 0) >= PER_HOUR) {
    return json({ error: "rate_limited" }, 429);
  }

  const { data: programmeRow } = await admin
    .schema("core")
    .from("programmes")
    .select("id")
    .eq("slug", programme ?? "side-quest")
    .maybeSingle();

  const { data, error } = await admin
    .schema("programmes")
    .from("removal_requests")
    .insert({
      content_url: fields.content_url || null,
      details: fields.details,
      programme_id: programmeRow?.id ?? null,
      requester_email: fields.requester_email,
      requester_name: fields.requester_name,
    })
    .select("due_at")
    .single();
  if (error || !data) {
    log.error(`Removal request failed: ${parseError(error)}`);
    return json({ error: "failed" }, 500);
  }
  return json({ dueAt: data.due_at, ok: true });
};

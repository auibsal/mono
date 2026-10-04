import { authenticateRequest } from "@repo/auth/verify";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { webhooks } from "@repo/webhooks";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, preflight } from "@/lib/cors";
import { isManager, membershipRole } from "@/lib/membership";

const body = z.object({ organizationId: z.uuid() });

export const OPTIONS = preflight;

/** A one-time link to the organization's webhook settings (owners, admins). */
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

  const { organizationId } = parsed.data;
  if (!isManager(await membershipRole(session, organizationId))) {
    return json({ error: "forbidden" }, 403);
  }

  try {
    const portal = await webhooks.getAppPortal(organizationId);
    return json({ url: portal.url });
  } catch (error) {
    log.error(`Webhook portal failed: ${parseError(error)}`);
    return json({ error: "not_configured" }, 503);
  }
};

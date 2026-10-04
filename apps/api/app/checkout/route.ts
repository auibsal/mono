import {
  attributionSchema,
  collectAttribution,
  getConversions,
} from "@repo/analytics/conversions";
import { authenticateRequest } from "@repo/auth/verify";
import { project } from "@repo/config";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { getPurchasePolicy, type Platform } from "@repo/payments";
import { getBilling } from "@repo/payments/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { corsHeaders, preflight } from "@/lib/cors";
import { isManager, membershipRole } from "@/lib/membership";

const body = z.object({
  /** Ad identifiers from `getAttribution()` in @repo/analytics/client. */
  attribution: attributionSchema.optional(),
  organizationId: z.uuid(),
  planId: z.string().min(1),
  redirectUrl: z.url().optional(),
});

const platforms = new Set<Platform>(["web", "ios", "android"]);

/** Only redirect back into our own app, never to arbitrary sites. */
const safeRedirect = (redirectUrl: string | undefined) => {
  const app = new URL(env.NEXT_PUBLIC_APP_URL);
  if (!redirectUrl) {
    return new URL(`/${project.locale.default}/billing`, app).toString();
  }
  return new URL(redirectUrl).origin === app.origin ? redirectUrl : undefined;
};

export const OPTIONS = preflight;

/**
 * Starts a checkout for a plan. Called by the web app and the native apps
 * with `Authorization: Bearer <Supabase access token>`.
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

  // Store billing rules: digital goods can't use third-party checkout inside
  // the iOS/Android apps (see @repo/payments/policy).
  const platformHeader = request.headers.get("x-client-platform") as Platform;
  const platform = platforms.has(platformHeader) ? platformHeader : "web";
  const policy = getPurchasePolicy(platform);
  if (!policy.allowed) {
    return json({ error: policy.reason }, 403);
  }

  const { organizationId, planId } = parsed.data;
  const redirectUrl = safeRedirect(parsed.data.redirectUrl);
  if (!redirectUrl) {
    return json({ error: "invalid_redirect" }, 400);
  }

  if (!isManager(await membershipRole(session, organizationId))) {
    return json({ error: "forbidden" }, 403);
  }

  // Browser checkouts keep the context needed to report the purchase to ad
  // platforms later; nothing is stored unless conversions are configured.
  const metadata =
    platform === "web" && getConversions().enabled
      ? { attribution: collectAttribution(request, parsed.data.attribution) }
      : undefined;

  try {
    const checkout = await getBilling().startCheckout({
      metadata,
      organizationId,
      planId,
      redirectUrl,
      userId: session.userId,
    });
    return json(checkout);
  } catch (error) {
    log.error(`Checkout failed: ${parseError(error)}`);
    return json({ error: "checkout_failed" }, 502);
  }
};

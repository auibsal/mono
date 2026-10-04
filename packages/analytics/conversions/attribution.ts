import { z } from "zod";
import { compact } from "./hash";
import type { Attribution } from "./types";

const id = z.string().trim().min(1).max(500);

/** What the browser sends (see `getAttribution` in @repo/analytics/client). */
export const attributionSchema = z
  .object({
    fbc: id,
    fbp: id,
    sourceUrl: z.url().max(2000),
    ttclid: id,
    ttp: id,
  })
  .partial();

export type ClientAttribution = z.infer<typeof attributionSchema>;

/**
 * The visitor's IP address as reported by the platform in front of the app
 * (Cloudflare, then Vercel, then the first X-Forwarded-For hop).
 */
const clientIp = (headers: Headers) =>
  headers.get("cf-connecting-ip") ??
  headers.get("x-real-ip") ??
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  undefined;

/**
 * Combines the browser's identifiers with the request's IP and user agent.
 * Call it on a request made directly by the visitor's browser.
 */
export const collectAttribution = (
  request: Request,
  fromBrowser: ClientAttribution = {}
): Attribution =>
  compact({
    ...fromBrowser,
    ipAddress: clientIp(request.headers),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

/** Reads attribution stored in a record's metadata, if any. */
export const readAttribution = (metadata: unknown): Attribution | undefined => {
  const value =
    metadata && typeof metadata === "object" && "attribution" in metadata
      ? metadata.attribution
      : undefined;
  const parsed = attributionSchema
    .extend({ ipAddress: id, userAgent: id })
    .partial()
    .safeParse(value);
  return parsed.success && Object.keys(parsed.data).length > 0
    ? parsed.data
    : undefined;
};

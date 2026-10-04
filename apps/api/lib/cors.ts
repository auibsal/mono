import { env } from "@/env";

const allowedOrigins = () =>
  new Set([
    new URL(env.NEXT_PUBLIC_APP_URL).origin,
    new URL(env.NEXT_PUBLIC_WEB_URL).origin,
  ]);

/** CORS headers for an allowed origin; empty for anything else. */
export const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin");

  if (!(origin && allowedOrigins().has(origin))) {
    return {};
  }

  return {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const preflight = (request: Request) =>
  new Response(null, { headers: corsHeaders(request), status: 204 });

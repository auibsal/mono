import { env } from "@/env";

// Origins of the Capacitor webviews (iOS, Android). Written literally because
// `new URL("capacitor://localhost").origin` is "null" for custom schemes.
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

const allowedOrigins = () =>
  new Set([
    new URL(env.NEXT_PUBLIC_APP_URL).origin,
    new URL(env.NEXT_PUBLIC_WEB_URL).origin,
    ...NATIVE_ORIGINS,
  ]);

/** CORS headers for an allowed origin; empty for anything else. */
export const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin");

  if (!(origin && allowedOrigins().has(origin))) {
    return {};
  }

  return {
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-client-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const preflight = (request: Request) =>
  new Response(null, { headers: corsHeaders(request), status: 204 });

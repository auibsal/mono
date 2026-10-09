import { createClient } from "@supabase/supabase-js";

/**
 * The design system is for Society officers. Visitors bring the Nexus
 * session cookie (shared across *.auibsal.org); the gate reads it, verifies
 * the token with Supabase and asks the database whether the member may read
 * the internal library (or manages settings). Nobody else gets in, and no
 * vendor login is involved.
 *
 * The gate never refreshes a session: refreshing here would spend the
 * browser's refresh token. An expired session goes to the Nexus, which
 * refreshes it and sends the member back.
 */

export const PERMISSIONS = ["library.read", "settings.manage"] as const;

const BASE64_PREFIX = "base64-";
const DASH = /-/g;
const UNDERSCORE = /_/g;

export interface GateEnv {
  nexusUrl: string;
  publishableKey: string;
  supabaseUrl: string;
}

export type GateResult =
  | { kind: "allow" }
  | { kind: "sign-in"; location: string }
  | { kind: "forbidden" };

const cookieMap = (header: string | null) => {
  const map = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) {
      map.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
    }
  }
  return map;
};

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(DASH, "+").replace(UNDERSCORE, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** The access token from @supabase/ssr's cookie (chunked or whole). */
export const accessTokenFrom = (
  cookieHeader: string | null,
  supabaseUrl: string
): { expiresAt: number; token: string } | null => {
  const [ref] = new URL(supabaseUrl).hostname.split(".");
  const key = `sb-${ref}-auth-token`;
  const cookies = cookieMap(cookieHeader);
  let raw = cookies.get(key);
  if (!raw) {
    const chunks: string[] = [];
    for (let i = 0; cookies.has(`${key}.${i}`); i += 1) {
      chunks.push(cookies.get(`${key}.${i}`) ?? "");
    }
    raw = chunks.length > 0 ? chunks.join("") : undefined;
  }
  if (!raw) {
    return null;
  }
  try {
    const value = decodeURIComponent(raw);
    const json = value.startsWith(BASE64_PREFIX)
      ? decodeBase64Url(value.slice(BASE64_PREFIX.length))
      : value;
    const session = JSON.parse(json) as {
      access_token?: unknown;
      expires_at?: unknown;
    };
    if (typeof session.access_token !== "string") {
      return null;
    }
    return {
      expiresAt:
        typeof session.expires_at === "number" ? session.expires_at : 0,
      token: session.access_token,
    };
  } catch {
    return null;
  }
};

const signIn = (env: GateEnv, requestUrl: string): GateResult => {
  const to = new URL(requestUrl);
  const location = new URL("/en/continue", env.nexusUrl);
  location.searchParams.set("to", to.toString());
  return { kind: "sign-in", location: location.toString() };
};

export const checkAccess = async (
  request: Request,
  env: GateEnv,
  now = Date.now()
): Promise<GateResult> => {
  const session = accessTokenFrom(
    request.headers.get("cookie"),
    env.supabaseUrl
  );
  // A minute's margin, so the token does not expire mid-check.
  if (!session || session.expiresAt * 1000 < now + 60_000) {
    return signIn(env, request.url);
  }
  const supabase = createClient(env.supabaseUrl, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.token}` } },
  });
  const { data, error } = await supabase.auth.getClaims(session.token);
  if (error || !data) {
    return signIn(env, request.url);
  }
  if (typeof data.claims.client_id === "string" && data.claims.client_id) {
    // Tokens issued to third-party apps never open internal tools.
    return { kind: "forbidden" };
  }
  const checks = await Promise.all(
    PERMISSIONS.map((permission) =>
      supabase.schema("access").rpc("has_permission_anywhere", { permission })
    )
  );
  return checks.some((c) => c.data === true)
    ? { kind: "allow" }
    : { kind: "forbidden" };
};

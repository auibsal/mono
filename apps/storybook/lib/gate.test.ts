import { beforeEach, describe, expect, test, vi } from "vitest";

const getClaims = vi.fn();
const rpc = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getClaims },
    schema: () => ({ rpc }),
  }),
}));

const { accessTokenFrom, checkAccess } = await import("./gate");

const SUPABASE = "https://fghzahtzgelqnpwdhwjo.supabase.co";
const env = {
  nexusUrl: "https://nexus.auibsal.org",
  publishableKey: "sb_publishable_x",
  supabaseUrl: SUPABASE,
};
const NOW = 1_800_000_000_000;

const PLUS = /\+/g;
const SLASH = /\//g;
const PADDING = /[=]+$/;

const cookieFor = (session: object, chunked = false) => {
  const encoded = btoa(JSON.stringify(session))
    .replace(PLUS, "-")
    .replace(SLASH, "_")
    .replace(PADDING, "");
  const value = `base64-${encoded}`;
  const key = "sb-fghzahtzgelqnpwdhwjo-auth-token";
  if (!chunked) {
    return `${key}=${value}`;
  }
  const half = Math.ceil(value.length / 2);
  return `${key}.0=${value.slice(0, half)}; other=1; ${key}.1=${value.slice(half)}`;
};

const request = (cookie?: string) =>
  new Request("https://design.auibsal.org/?path=/docs/intro", {
    headers: cookie ? { cookie } : {},
  });

const fresh = { access_token: "jwt", expires_at: NOW / 1000 + 3600 };

describe("design system gate", () => {
  beforeEach(() => {
    getClaims.mockReset();
    rpc.mockReset();
  });

  test("reads whole and chunked session cookies", () => {
    expect(accessTokenFrom(cookieFor(fresh), SUPABASE)?.token).toBe("jwt");
    expect(accessTokenFrom(cookieFor(fresh, true), SUPABASE)?.token).toBe(
      "jwt"
    );
    expect(accessTokenFrom("x=1", SUPABASE)).toBeNull();
  });

  test("sends visitors without a session to the Nexus and back", async () => {
    const result = await checkAccess(request(), env, NOW);
    expect(result.kind).toBe("sign-in");
    const location = new URL(result.kind === "sign-in" ? result.location : "");
    expect(location.origin + location.pathname).toBe(
      "https://nexus.auibsal.org/en/continue"
    );
    expect(location.searchParams.get("to")).toBe(
      "https://design.auibsal.org/?path=/docs/intro"
    );
  });

  test("an expired session also goes to the Nexus, never refreshed here", async () => {
    const stale = { access_token: "jwt", expires_at: NOW / 1000 - 10 };
    expect((await checkAccess(request(cookieFor(stale)), env, NOW)).kind).toBe(
      "sign-in"
    );
    expect(getClaims).not.toHaveBeenCalled();
  });

  test("officers get in; members without the permission do not", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });
    rpc.mockResolvedValue({ data: true });
    expect((await checkAccess(request(cookieFor(fresh)), env, NOW)).kind).toBe(
      "allow"
    );
    rpc.mockResolvedValue({ data: false });
    expect((await checkAccess(request(cookieFor(fresh)), env, NOW)).kind).toBe(
      "forbidden"
    );
  });

  test("third-party app tokens never open it", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { client_id: "app", sub: "u1" } },
      error: null,
    });
    expect((await checkAccess(request(cookieFor(fresh)), env, NOW)).kind).toBe(
      "forbidden"
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

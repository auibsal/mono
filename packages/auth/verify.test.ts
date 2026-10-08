// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./keys", () => ({
  keys: () => ({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getClaims } }),
}));

const { authenticateRequest } = await import("./verify");

const request = () =>
  new Request("https://api.auibsal.org/x", {
    headers: { authorization: "Bearer token" },
  });

describe("authenticateRequest", () => {
  beforeEach(() => getClaims.mockReset());

  test("accepts the Society's own tokens", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });
    const session = await authenticateRequest(request());
    expect(session?.userId).toBe("u1");
    expect(session?.clientId).toBeNull();
  });

  test("turns away third-party app tokens unless the route takes them", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { client_id: "app-1", sub: "u1" } },
      error: null,
    });
    expect(await authenticateRequest(request())).toBeNull();
    const session = await authenticateRequest(request(), { apps: true });
    expect(session?.clientId).toBe("app-1");
  });

  test("rejects a missing or invalid token", async () => {
    expect(
      await authenticateRequest(new Request("https://api.auibsal.org/x"))
    ).toBeNull();
    getClaims.mockResolvedValue({ data: null, error: new Error("bad") });
    expect(await authenticateRequest(request())).toBeNull();
  });
});

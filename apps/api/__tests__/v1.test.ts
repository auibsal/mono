// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateRequest = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@repo/auth/verify", () => ({ authenticateRequest }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn() },
}));

const { DataError } = await import("@repo/sal-data/client");
const { member } = await import("@/lib/v1");

const call = (handler: Parameters<typeof member>[0]) =>
  member(handler)(new Request("https://api.auibsal.org/v1/me"), {
    params: Promise.resolve({}),
  });

describe("the v1 API", () => {
  beforeEach(() => authenticateRequest.mockReset());

  test("takes app tokens and answers with open CORS", async () => {
    authenticateRequest.mockResolvedValue({
      clientId: "app-1",
      supabase: {},
      userId: "u1",
    });
    const response = await call(async ({ clientId }) =>
      Response.json({ clientId })
    );
    expect(authenticateRequest.mock.calls[0][1]).toEqual({ apps: true });
    expect(await response.json()).toEqual({ clientId: "app-1" });
  });

  test("answers 401 without a token", async () => {
    authenticateRequest.mockResolvedValue(null);
    const response = await call(() => Promise.resolve(new Response()));
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("maps database refusals to HTTP", async () => {
    authenticateRequest.mockResolvedValue({
      clientId: null,
      supabase: {},
      userId: "u1",
    });
    const refused = await call(() => {
      throw new DataError({ code: "42501", message: "no" });
    });
    expect(refused.status).toBe(403);
    const broken = await call(() => {
      throw new Error("boom");
    });
    expect(broken.status).toBe(500);
    expect(await broken.json()).toEqual({ error: "server_error" });
  });
});

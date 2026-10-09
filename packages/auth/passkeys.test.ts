import { describe, expect, test, vi } from "vitest";
import {
  addPasskey,
  listPasskeys,
  PASSKEY_NAME_MAX,
  signInWithPasskey,
  toPasskeyError,
} from "./passkeys";

const client = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as Parameters<typeof signInWithPasskey>[0];

describe("passkey helpers", () => {
  test("maps WebAuthn and Supabase errors to UI codes", () => {
    expect(toPasskeyError({ code: "ERROR_CEREMONY_ABORTED" })).toBe(
      "cancelled"
    );
    expect(
      toPasskeyError({
        cause: { name: "NotAllowedError" },
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      })
    ).toBe("cancelled");
    expect(
      toPasskeyError({
        cause: { name: "UnknownError" },
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      })
    ).toBe("unknown");
    expect(
      toPasskeyError({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" })
    ).toBe("already_registered");
    expect(toPasskeyError({ code: "webauthn_challenge_expired" })).toBe(
      "expired"
    );
    expect(toPasskeyError({ status: 429 })).toBe("rate_limited");
    expect(toPasskeyError(null)).toBe("unknown");
  });

  test("reports a sign-in failure without throwing", async () => {
    const supabase = client({
      signInWithPasskey: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "ERROR_CEREMONY_ABORTED" },
      }),
    });
    expect(await signInWithPasskey(supabase)).toEqual({
      code: "cancelled",
      ok: false,
    });
  });

  test("lists passkeys newest first", async () => {
    const supabase = client({
      passkey: {
        list: vi.fn().mockResolvedValue({
          data: [
            { created_at: "2026-10-01T00:00:00Z", id: "old" },
            {
              created_at: "2026-10-09T00:00:00Z",
              friendly_name: "Laptop",
              id: "new",
              last_used_at: "2026-10-09T01:00:00Z",
            },
          ],
          error: null,
        }),
      },
    });
    expect(await listPasskeys(supabase)).toEqual({
      ok: true,
      value: [
        {
          createdAt: "2026-10-09T00:00:00Z",
          id: "new",
          lastUsedAt: "2026-10-09T01:00:00Z",
          name: "Laptop",
        },
        {
          createdAt: "2026-10-01T00:00:00Z",
          id: "old",
          lastUsedAt: null,
          name: null,
        },
      ],
    });
  });

  test("names a new passkey, trimmed to the allowed length", async () => {
    const update = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = client({
      passkey: { update },
      registerPasskey: vi
        .fn()
        .mockResolvedValue({ data: { id: "pk" }, error: null }),
    });
    const result = await addPasskey(supabase, `  ${"a".repeat(200)}  `);
    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      friendlyName: "a".repeat(PASSKEY_NAME_MAX),
      passkeyId: "pk",
    });
  });

  test("skips naming when no name is given", async () => {
    const update = vi.fn();
    const supabase = client({
      passkey: { update },
      registerPasskey: vi
        .fn()
        .mockResolvedValue({ data: { id: "pk" }, error: null }),
    });
    await addPasskey(supabase, "   ");
    expect(update).not.toHaveBeenCalled();
  });
});

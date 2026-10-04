/**
 * Runs against a local Supabase stack. Export the local keys printed by
 * `supabase status -o env` (API_URL, PUBLISHABLE_KEY, SECRET_KEY), then:
 *   SUPABASE_INTEGRATION=1 bun run --cwd packages/auth test
 */
import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";
import { signInWithPassword } from "./email";

const url = process.env.API_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.PUBLISHABLE_KEY ?? "";
// createClient needs a key even when the suite is skipped.
const placeholderKey = "skipped";
const secretKey = process.env.SECRET_KEY ?? "";

describe.skipIf(
  !(process.env.SUPABASE_INTEGRATION && publishableKey && secretKey)
)("auth (local Supabase)", () => {
  const admin = createClient<Database>(url, secretKey || placeholderKey, {
    auth: { persistSession: false },
  });
  const password = "integration-test-1";
  const stamp = Date.now();

  beforeAll(async () => {
    const results = await Promise.all(
      [`aa${stamp}@auib.edu.iq`, `bb${stamp}@example.com`].map((email) =>
        admin.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
          user_metadata: { full_name_en: "Integration" },
        })
      )
    );
    for (const { error } of results) {
      expect(error).toBeNull();
    }
  });

  test("an AUIB account is a member as soon as it signs in", async () => {
    const supabase = createClient<Database>(
      url,
      publishableKey || placeholderKey,
      {
        auth: { persistSession: false },
      }
    );
    const result = await signInWithPassword(
      supabase,
      `AA${stamp}@auib.edu.iq`,
      password
    );
    expect(result.ok).toBe(true);

    const { data } = await supabase.schema("membership").rpc("my_status");
    expect(data?.[0]).toMatchObject({ is_member: true, verified: true });
  });

  test("another domain waits in the verification queue", async () => {
    const supabase = createClient<Database>(
      url,
      publishableKey || placeholderKey,
      {
        auth: { persistSession: false },
      }
    );
    await signInWithPassword(supabase, `bb${stamp}@example.com`, password);

    const { data } = await supabase.schema("membership").rpc("my_status");
    expect(data?.[0]).toMatchObject({ is_member: false, verified: false });

    const { data: requests } = await supabase
      .schema("membership")
      .from("verification_requests")
      .select("status");
    expect(requests).toEqual([{ status: "pending" }]);
  });

  test("a wrong password is reported as invalid credentials", async () => {
    const supabase = createClient<Database>(
      url,
      publishableKey || placeholderKey,
      {
        auth: { persistSession: false },
      }
    );
    const result = await signInWithPassword(
      supabase,
      `aa${stamp}@auib.edu.iq`,
      "wrong-password-1"
    );
    expect(result).toEqual({ code: "invalid_credentials", ok: false });
  });
});

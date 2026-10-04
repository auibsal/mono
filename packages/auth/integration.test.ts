/**
 * Runs against a local Supabase stack. Export the local keys printed by
 * `supabase status -o env` (API_URL, PUBLISHABLE_KEY), then:
 *   SUPABASE_INTEGRATION=1 bun run --cwd packages/auth test
 * Uses the test OTP from supabase/config.toml (+964 770 000 0000 / 123456).
 */
import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";
import { listMemberships, pickActiveOrganization } from "./organizations";
import { sendPhoneOtp, verifyPhoneOtp } from "./otp";

const url = process.env.API_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.PUBLISHABLE_KEY ?? "";

describe.skipIf(!(process.env.SUPABASE_INTEGRATION && publishableKey))(
  "auth (local Supabase)",
  () => {
    let supabase: ReturnType<typeof createClient<Database>>;

    beforeAll(() => {
      supabase = createClient<Database>(url, publishableKey, {
        auth: { persistSession: false },
      });
    });

    test("signs in with a phone OTP and works inside an organization", async () => {
      const sent = await sendPhoneOtp(supabase, "٠٧٧٠ ٠٠٠ ٠٠٠٠", {
        fullName: "Test User",
        locale: "en",
      });
      expect(sent).toMatchObject({ ok: true, phone: "+9647700000000" });

      const verified = await verifyPhoneOtp(
        supabase,
        "+9647700000000",
        "123456"
      );
      expect(verified.ok).toBe(true);
      const userId = verified.ok ? verified.value.userId : "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, locale")
        .eq("id", userId)
        .single();
      expect(profile?.locale).toBeDefined();

      const slug = `org-${Date.now()}`;
      const { data: organization, error } = await supabase.rpc(
        "create_organization",
        { org_name: "Integration Org", org_slug: slug }
      );
      expect(error).toBeNull();

      const memberships = await listMemberships(supabase, userId);
      expect(
        pickActiveOrganization(memberships, organization?.id)
      ).toMatchObject({
        role: "owner",
        slug,
      });

      const { error: insertError } = await supabase.from("projects").insert({
        created_by: userId,
        name: "First",
        organization_id: organization?.id ?? "",
      });
      expect(insertError).toBeNull();

      // Billing tables are read-only for users, even owners.
      const { error: forged } = await supabase.from("payments").insert({
        amount: 1000,
        organization_id: organization?.id,
        provider: "wayl",
        reference_id: `forged-${slug}`,
      });
      expect(forged?.code).toBe("42501");

      await supabase.auth.signOut();
    });

    test("rejects a wrong code", async () => {
      await sendPhoneOtp(supabase, "07700000000");
      const result = await verifyPhoneOtp(supabase, "+9647700000000", "000000");
      expect(result).toMatchObject({ code: "invalid_code", ok: false });
    });
  }
);

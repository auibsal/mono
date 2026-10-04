/**
 * Runs against a local Supabase stack. Export the local keys printed by
 * `supabase status -o env` (API_URL, SECRET_KEY), then:
 *   SUPABASE_INTEGRATION=1 bun run --cwd packages/payments test
 */
import { randomUUID } from "node:crypto";
import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";
import { createMockProvider } from "../providers/mock";
import { createBillingService } from "./service";
import { createSupabaseBillingRepository } from "./supabase";

const url = process.env.API_URL ?? "http://127.0.0.1:54321";
const secretKey = process.env.SECRET_KEY ?? "";

describe.skipIf(!(process.env.SUPABASE_INTEGRATION && secretKey))(
  "billing with Supabase (local)",
  () => {
    let admin: ReturnType<typeof createClient<Database>>;

    beforeAll(() => {
      admin = createClient<Database>(url, secretKey, {
        auth: { persistSession: false },
      });
    });

    test("checkout, webhook, idempotency and renewal", async () => {
      const { data: user } = await admin.auth.admin.createUser({
        phone: `+96477${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        phone_confirm: true,
      });
      const { data: organization } = await admin
        .from("organizations")
        .insert({
          name: "Billing Org",
          slug: `billing-${randomUUID().slice(0, 8)}`,
        })
        .select()
        .single();
      expect(organization).toBeTruthy();

      let now = new Date();
      const provider = createMockProvider();
      const billing = createBillingService({
        now: () => now,
        provider,
        repository: createSupabaseBillingRepository(admin),
      });

      const { referenceId } = await billing.startCheckout({
        organizationId: organization?.id ?? "",
        planId: "starter-monthly",
        userId: user.user?.id ?? "",
      });

      const delivery = provider.settle(referenceId, "paid");
      expect(await billing.handleWebhook(delivery)).toMatchObject({
        to: "paid",
      });
      expect(await billing.handleWebhook(delivery)).toEqual({
        status: "duplicate",
      });

      const { data: subscription } = await admin
        .from("subscriptions")
        .select()
        .eq("organization_id", organization?.id ?? "")
        .single();
      expect(subscription?.status).toBe("active");

      now = new Date(
        new Date(subscription?.current_period_end ?? 0).getTime() - 86_400_000
      );
      const renewal = await billing.issueRenewals();
      expect(
        renewal.invoices.some(
          (invoice) => invoice.subscriptionId === subscription?.id
        )
      ).toBe(true);
    });
  }
);

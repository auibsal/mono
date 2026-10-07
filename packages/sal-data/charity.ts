import { Constants } from "@repo/database";
import { z } from "zod";
import { type Client, unwrap } from "./client";

export const ledgerSources = Constants.charity.Enums.source;

export const ledgerEntrySchema = z
  .object({
    amount_iqd: z.number().int().positive().max(1_000_000_000),
    campaign_id: z.uuid(),
    counted_by: z.uuid(),
    counted_with: z.uuid(),
    note: z.string().max(1000).optional(),
    occurred_on: z.iso.date(),
    source: z.enum(ledgerSources),
  })
  .refine((e) => e.counted_by !== e.counted_with, {
    message: "two_counters",
    path: ["counted_with"],
  });

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

export interface CampaignProgress {
  campaign_id: string;
  cost_per_unit_iqd: number;
  counted_iqd: number;
  pending_iqd: number;
  target_units: number | null;
  units: number;
}

/** Counted (signed-off) totals and the Warmth Meter. */
export const campaignProgress = async (client: Client, campaignId?: string) =>
  (unwrap(
    await client
      .schema("charity")
      .rpc("campaign_progress", { campaign_id: campaignId })
  ) ?? []) as CampaignProgress[];

export const activeCampaigns = async (client: Client) =>
  unwrap(
    await client
      .schema("charity")
      .from("campaigns")
      .select("*, partner:partners(*)")
      .eq("status", "active")
      .order("starts_on", { ascending: false })
  );

/** Receipts the campaign has made public (files through apps/api). */
export const publicReceipts = async (client: Client, campaignId: string) =>
  unwrap(
    await client
      .schema("charity")
      .from("receipts")
      .select("id, description_en, description_ar, amount_iqd, created_at")
      .eq("campaign_id", campaignId)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
  ) ?? [];

/** Published impact figures, in order. */
export const impactMetrics = async (client: Client, campaignId: string) =>
  unwrap(
    await client
      .schema("charity")
      .from("impact_metrics")
      .select(
        "id, label_en, label_ar, value, unit_en, unit_ar, report_en, report_ar"
      )
      .eq("campaign_id", campaignId)
      .not("published_at", "is", null)
      .order("sort")
  ) ?? [];

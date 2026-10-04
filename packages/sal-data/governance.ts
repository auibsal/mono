import { highestSpendingLimitIqd } from "@repo/rbac";
import { z } from "zod";
import { type Client, unwrap } from "./client";

export const spendingRequestSchema = z.object({
  amount_iqd: z.number().int().positive(),
  campaign_id: z.uuid().optional(),
  programme_id: z.uuid().optional(),
  purpose_ar: z.string().max(500).optional(),
  purpose_en: z.string().trim().min(1).max(500),
  resolution_id: z.uuid().optional(),
});

/** Above the highest lead limit, an adopted Council resolution is required. */
export const needsCouncilVote = (amountIqd: number) => amountIqd > highestSpendingLimitIqd;

export const RON = "RON" as const;

/** A ranked ballot: position id → candidate ids (or RON) in order. */
export const ballotSchema = z.record(
  z.uuid(),
  z
    .array(z.union([z.uuid(), z.literal(RON)]))
    .refine((ranks) => new Set(ranks).size === ranks.length, { message: "duplicate_rank" })
);

export type Ballot = z.infer<typeof ballotSchema>;

export const castBallot = async (client: Client, electionId: string, ballot: Ballot) =>
  unwrap(
    await client
      .schema("governance")
      .rpc("cast_ballot", { choices: ballotSchema.parse(ballot), election_id: electionId })
  );

export const councilRoster = async (client: Client) =>
  unwrap(await client.schema("governance").rpc("council_roster")) ?? [];

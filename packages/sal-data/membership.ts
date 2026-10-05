import { z } from "zod";
import { type Client, unwrap } from "./client";

export const BIO_MAX_WORDS = 50;

const WHITESPACE = /\s+/;

export const wordCount = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(WHITESPACE).length : 0;
};

export const profileSchema = z.object({
  bio: z
    .string()
    .max(600)
    .refine((v) => wordCount(v) <= BIO_MAX_WORDS, { message: "bio_too_long" })
    .optional(),
  camera_shy: z.boolean(),
  full_name_ar: z.string().trim().max(120).optional(),
  full_name_en: z.string().trim().min(1).max(120),
  locale: z.enum(["en", "ar"]),
  notify_email: z.boolean(),
  personal_email: z.email().optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

const membership = (client: Client) => client.schema("membership");

export interface MemberStatus {
  activities: number;
  is_member: boolean;
  member_since: string | null;
  pending_pledges: ("human_authorship" | "member")[];
  tier: "member" | "fellow" | "honorary" | "alumni" | null;
  verified: boolean;
  voting_member: boolean;
}

export const myStatus = async (
  client: Client
): Promise<MemberStatus | null> => {
  const rows = unwrap(await membership(client).rpc("my_status"));
  return (rows?.[0] as MemberStatus | undefined) ?? null;
};

/** Constitution: a Voting Member has this many activities this or last semester. */
export const VOTING_ACTIVITIES = 2;

export const acceptPledge = async (
  client: Client,
  kind: "human_authorship" | "member",
  version: string
) => unwrap(await membership(client).rpc("accept_pledge", { kind, version }));

export const calendarToken = async (client: Client) =>
  unwrap(await membership(client).rpc("calendar_token"));

export const resetCalendarToken = async (client: Client) =>
  unwrap(await membership(client).rpc("reset_calendar_token"));

// ── Admin (members.manage / members.verify / roles.assign) ──────────────────

export const tiers = ["member", "fellow", "honorary", "alumni"] as const;
export type Tier = (typeof tiers)[number];

export interface DirectoryRow {
  activities: number;
  created_at: string;
  email: string;
  full_name_ar: string | null;
  full_name_en: string;
  member_since: string | null;
  tier: Tier | null;
  user_id: string;
  verified_at: string | null;
  voting_member: boolean;
}

/** Every account with its sign-in email. Raises 42501 without the permission. */
export const directory = async (client: Client) =>
  (unwrap(await membership(client).rpc("directory")) ?? []) as DirectoryRow[];

export const manualActivitySchema = z.object({
  note: z.string().trim().min(1).max(500),
  occurred_at: z.iso.datetime({ offset: true }),
  target_user: z.uuid(),
});

export const addManualActivity = async (
  client: Client,
  input: z.infer<typeof manualActivitySchema>
) =>
  unwrap(
    await membership(client).rpc(
      "add_manual_activity",
      manualActivitySchema.parse(input)
    )
  );

export const setTier = async (client: Client, userId: string, tier: Tier) =>
  unwrap(
    await membership(client).rpc("set_tier", {
      new_tier: tier,
      target_user: userId,
    })
  );

export const decideVerification = async (
  client: Client,
  requestId: string,
  approve: boolean,
  note?: string
) =>
  unwrap(
    await membership(client).rpc("decide_verification", {
      approve,
      note: note?.trim() || undefined,
      request_id: requestId,
    })
  );

import { z } from "zod";
import { type Client, unwrap } from "./client";

/**
 * Productions: staged readings and productions, with partners and other
 * AUIB clubs. Row Level Security and the RPCs hold the rules (rights before
 * performances, private audition notes, members choosing to show their
 * names); these are the typed reads and writes.
 */

export const productionKinds = ["staged_reading", "production"] as const;
export type ProductionKind = (typeof productionKinds)[number];

/** In order. `cancelled` can be reached from any stage before `closed`. */
export const productionStages = [
  "proposal",
  "approved",
  "auditions",
  "rehearsals",
  "tech",
  "performances",
  "closed",
] as const;
export type ProductionStage = (typeof productionStages)[number] | "cancelled";

export const scriptOrigins = ["original", "public_domain", "licensed"] as const;
export type ScriptOrigin = (typeof scriptOrigins)[number];

export const departments = ["cast", "crew", "creative"] as const;
export type Department = (typeof departments)[number];

export const auditionStatuses = [
  "signed_up",
  "cancelled",
  "called_back",
  "cast",
  "not_cast",
] as const;
export type AuditionStatus = (typeof auditionStatuses)[number];

/** Stages that need the script's rights cleared first. */
export const needsRights = (stage: ProductionStage) =>
  stage === "performances" || stage === "closed";

/** The stage after this one, or null at the end. */
export const nextStage = (stage: ProductionStage): ProductionStage | null => {
  const index = productionStages.indexOf(stage as never);
  return index < 0 || index === productionStages.length - 1
    ? null
    : productionStages[index + 1];
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const productionSchema = z.object({
  kind: z.enum(productionKinds),
  playwright: optionalText(200),
  programme_id: z.uuid().nullable().optional(),
  script_origin: z.enum(scriptOrigins),
  slug: z.string().trim().regex(SLUG).max(80),
  summary_ar: optionalText(1000),
  summary_en: optionalText(1000),
  title_ar: z.string().trim().min(1).max(200),
  title_en: z.string().trim().min(1).max(200),
});

export type ProductionInput = z.input<typeof productionSchema>;

/** Program Report (Form F-25, section B). */
export const reportSchema = z.object({
  report_lessons: z.string().trim().min(1).max(2000),
  report_money_in_iqd: z.number().int().min(0).nullable(),
  report_money_out_iqd: z.number().int().min(0).nullable(),
  report_people_reached: z.number().int().min(0),
  report_repeat: z.string().trim().min(1).max(2000),
  report_what_happened: z.string().trim().min(1).max(4000),
});

export type ReportInput = z.input<typeof reportSchema>;

export const creditSchema = z
  .object({
    department: z.enum(departments),
    partner_id: z.uuid().nullable().optional(),
    person_name: optionalText(200),
    role_ar: optionalText(200),
    role_en: z.string().trim().min(1).max(200),
    user_id: z.uuid().nullable().optional(),
  })
  .refine((c) => Boolean(c.user_id) !== Boolean(c.person_name), {
    message: "member_or_name",
    path: ["person_name"],
  });

export type CreditInput = z.input<typeof creditSchema>;

// ── Leads ───────────────────────────────────────────────────────────────────

export const createProduction = async (
  client: Client,
  input: ProductionInput
) => {
  const p = productionSchema.parse(input);
  return unwrap(
    await client
      .schema("programmes")
      .from("productions")
      .insert({ ...p, programme_id: p.programme_id ?? null })
      .select("id")
      .single()
  );
};

export const clearRights = async (client: Client, productionId: string) =>
  unwrap(
    await client
      .schema("programmes")
      .rpc("clear_production_rights", { production_id: productionId })
  );

export const saveReport = async (
  client: Client,
  productionId: string,
  input: ReportInput
) =>
  unwrap(
    await client
      .schema("programmes")
      .from("productions")
      .update(reportSchema.parse(input))
      .eq("id", productionId)
  );

export const signReport = async (client: Client, productionId: string) =>
  unwrap(
    await client
      .schema("programmes")
      .rpc("sign_production_report", { production_id: productionId })
  );

export const addCredit = async (
  client: Client,
  productionId: string,
  input: CreditInput
) => {
  const c = creditSchema.parse(input);
  return unwrap(
    await client
      .schema("programmes")
      .from("production_credits")
      .insert({
        department: c.department,
        partner_id: c.partner_id ?? null,
        person_name: c.person_name ?? null,
        production_id: productionId,
        role_ar: c.role_ar ?? null,
        role_en: c.role_en,
        user_id: c.user_id ?? null,
      })
  );
};

export const recordService = async (
  client: Client,
  productionId: string,
  memberId: string,
  hours: number
) =>
  unwrap(
    await client.schema("programmes").rpc("record_production_service", {
      hours,
      member_id: memberId,
      production_id: productionId,
    })
  );

/** Drafts certificates for a closed production; returns how many. */
export const draftCertificates = async (client: Client, productionId: string) =>
  Number(
    unwrap(
      await client
        .schema("programmes")
        .rpc("draft_production_certificates", { production_id: productionId })
    ) ?? 0
  );

export const partnerChoices = async (client: Client) =>
  unwrap(await client.schema("programmes").rpc("production_partner_choices")) ??
  [];

// ── Members ─────────────────────────────────────────────────────────────────

export const memberProductions = async (client: Client) =>
  unwrap(await client.schema("programmes").rpc("member_productions")) ?? [];

export const signUpForAudition = async (
  client: Client,
  auditionId: string,
  interest?: string
) =>
  unwrap(
    await client.schema("programmes").rpc("sign_up_for_audition", {
      audition_id: auditionId,
      interest: interest?.trim() || undefined,
    })
  );

export const cancelAudition = async (client: Client, auditionId: string) =>
  unwrap(
    await client
      .schema("programmes")
      .rpc("cancel_audition", { audition_id: auditionId })
  );

export const setCreditVisibility = async (
  client: Client,
  creditId: string,
  visible: boolean
) =>
  unwrap(
    await client
      .schema("programmes")
      .rpc("set_credit_visibility", { credit_id: creditId, visible })
  );

// ── Public ──────────────────────────────────────────────────────────────────

export const publicProductions = async (client: Client) =>
  unwrap(await client.schema("programmes").rpc("public_productions")) ?? [];

export const publicProduction = async (
  client: Client,
  productionId: string
) => {
  const args = { production_id: productionId };
  const [credits, partners, performances] = await Promise.all([
    client.schema("programmes").rpc("public_production_credits", args),
    client.schema("programmes").rpc("public_production_partners", args),
    client.schema("programmes").rpc("public_production_events", args),
  ]);
  return {
    credits: unwrap(credits) ?? [],
    partners: unwrap(partners) ?? [],
    performances: unwrap(performances) ?? [],
  };
};

import { z } from "zod";
import { type Client, DataError, unwrap } from "./client";

/**
 * Partnerships (Policy Manual P11, P8). The register, memoranda (Form F-26),
 * conflict declarations (Form F-18), affiliations and member offers. Row
 * Level Security and the signing RPC decide who may do what.
 */

export const partnerKinds = [
  "club",
  "department",
  "cultural",
  "publisher",
  "archive",
  "media",
  "business",
  "foundation",
  "charity",
  "university",
  "other",
] as const;

export const partnerReach = ["auib", "iraq", "international"] as const;

export const partnerStatuses = [
  "prospect",
  "active",
  "lapsed",
  "ended",
] as const;

/** What a signed memorandum allows on the platform. */
export const agreementGrants = [
  "journal_submissions",
  "guest_editing",
  "event_cohosting",
  "member_offer",
  "shared_branding",
  "productions",
  "volunteering",
] as const;

export type AgreementGrant = (typeof agreementGrants)[number];

/** The five questions on Form F-18. */
export const conflictKinds = [
  "close_person_applying",
  "supplier",
  "partner_role",
  "value_received",
  "other",
] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MOU_CODE = /^MOU-\d{4}-\d{2,3}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const partnerSchema = z.object({
  contact_email: z
    .union([z.email(), z.literal("")])
    .transform((value) => value || null)
    .nullable()
    .optional(),
  contact_name: optionalText(200),
  contact_role: optionalText(200),
  description_ar: optionalText(1000),
  description_en: optionalText(1000),
  is_listed: z.boolean(),
  kind: z.enum(partnerKinds),
  lead_id: z.uuid().nullable().optional(),
  logo_path: z.string().nullable().optional(),
  name_ar: optionalText(200),
  name_en: z.string().trim().min(1).max(200),
  notes: optionalText(4000),
  reach: z.enum(partnerReach),
  slug: z.string().regex(SLUG),
  status: z.enum(partnerStatuses),
  url: z
    .union([z.url({ protocol: /^https$/ }), z.literal("")])
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

export type PartnerInput = z.input<typeof partnerSchema>;

export const agreementSchema = z
  .object({
    branding: optionalText(4000),
    code: z
      .union([z.string().regex(MOU_CODE), z.literal("")])
      .transform((value) => value || null)
      .nullable()
      .optional(),
    ends_on: z
      .union([z.iso.date(), z.literal("")])
      .transform((value) => value || null)
      .nullable()
      .optional(),
    grants: z.array(z.enum(agreementGrants)),
    money: optionalText(4000),
    partner_contact: optionalText(400),
    partner_id: z.uuid(),
    partner_will: optionalText(4000),
    people_safety: optionalText(4000),
    purpose_ar: optionalText(2000),
    purpose_en: z.string().trim().min(1).max(2000),
    renew_by: z
      .union([z.iso.date(), z.literal("")])
      .transform((value) => value || null)
      .nullable()
      .optional(),
    sal_contact: optionalText(400),
    sal_will: optionalText(4000),
    starts_on: z.iso.date(),
  })
  .refine((a) => !a.ends_on || a.ends_on >= a.starts_on, {
    message: "ends_before_start",
    path: ["ends_on"],
  });

export type AgreementInput = z.input<typeof agreementSchema>;

export const offerSchema = z
  .object({
    code: optionalText(60),
    details_ar: optionalText(2000),
    details_en: z.string().trim().min(1).max(2000),
    ends_on: z
      .union([z.iso.date(), z.literal("")])
      .transform((value) => value || null)
      .nullable()
      .optional(),
    is_published: z.boolean(),
    partner_id: z.uuid(),
    starts_on: z.iso.date(),
    title_ar: optionalText(200),
    title_en: z.string().trim().min(1).max(200),
  })
  .refine((o) => !o.ends_on || o.ends_on >= o.starts_on, {
    message: "ends_before_start",
    path: ["ends_on"],
  });

export type OfferInput = z.input<typeof offerSchema>;

export const conflictItemSchema = z.object({
  affects: optionalText(1000),
  handling: optionalText(1000),
  kind: z.enum(conflictKinds),
  partner_id: z.uuid().nullable().optional(),
  what: z.string().trim().min(1).max(1000),
});

export const declarationSchema = z
  .object({
    items: z.array(conflictItemSchema).max(20),
    nothing_to_declare: z.boolean(),
    role_title: optionalText(200),
    semester_id: z.uuid().nullable().optional(),
  })
  .refine((d) => d.nothing_to_declare !== d.items.length > 0, {
    message: "declare_or_confirm",
    path: ["items"],
  });

export type DeclarationInput = z.input<typeof declarationSchema>;

// ── Public ──────────────────────────────────────────────────────────────────

/** Active, listed partners with a signed memorandum in force. */
export const publicPartners = async (client: Client) =>
  unwrap(await client.schema("governance").rpc("public_partners")) ?? [];

/** Days until a date (negative when it has passed). */
export const daysUntil = (date: string, today = new Date()) => {
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000);
};

/** Memoranda due for renewal within `days` (and those already overdue). */
export const renewalsDue = <
  T extends { renew_by: string | null; status: string },
>(
  agreements: readonly T[],
  days = 30,
  today = new Date()
) =>
  agreements.filter(
    (a) =>
      a.status === "signed" &&
      a.renew_by !== null &&
      daysUntil(a.renew_by, today) <= days
  );

// ── Members ─────────────────────────────────────────────────────────────────

/** Current offers for verified members (RLS returns none otherwise). */
export const memberOffers = async (client: Client) =>
  unwrap(
    await client
      .schema("governance")
      .from("member_offers")
      .select(
        "id, title_en, title_ar, details_en, details_ar, code, ends_on, partner_id"
      )
      .order("starts_on", { ascending: false })
  ) ?? [];

export const joinablePartners = async (client: Client) =>
  unwrap(await client.schema("governance").rpc("joinable_partners")) ?? [];

/** Partner names for a role holder's declaration (F-18). */
export const declarablePartners = async (client: Client) =>
  unwrap(await client.schema("governance").rpc("declarable_partners")) ?? [];

export const myDeclarations = async (client: Client) =>
  unwrap(
    await client
      .schema("governance")
      .from("conflict_declarations")
      .select(
        "id, role_title, nothing_to_declare, signed_at, received_at, semester_id, conflict_items (id, kind, partner_id, what, affects, handling, closed_on)"
      )
      .eq("user_id", (await client.auth.getUser()).data.user?.id ?? "")
      .order("signed_at", { ascending: false })
  ) ?? [];

export const closeConflictItem = async (client: Client, itemId: string) =>
  unwrap(
    await client
      .schema("governance")
      .from("conflict_items")
      .update({ closed_on: new Date().toISOString().slice(0, 10) })
      .eq("id", itemId)
  );

export const myAffiliations = async (client: Client) =>
  unwrap(
    await client
      .schema("governance")
      .from("partner_affiliations")
      .select("id, partner_id, status, note, created_at")
      .order("created_at", { ascending: false })
  ) ?? [];

export const requestAffiliation = async (
  client: Client,
  partnerId: string,
  note: string
) =>
  unwrap(
    await client
      .schema("governance")
      .from("partner_affiliations")
      .insert({ note: note.trim() || null, partner_id: partnerId })
  );

/** Saves a Form F-18 declaration and its items. */
export const declareConflicts = async (
  client: Client,
  input: DeclarationInput
) => {
  const parsed = declarationSchema.parse(input);
  const declaration = unwrap(
    await client
      .schema("governance")
      .from("conflict_declarations")
      .insert({
        nothing_to_declare: parsed.nothing_to_declare,
        role_title: parsed.role_title ?? null,
        semester_id: parsed.semester_id ?? null,
      })
      .select("id")
      .single()
  );
  if (!declaration) {
    throw new DataError({ message: "declaration_not_saved" });
  }
  if (parsed.items.length > 0) {
    unwrap(
      await client
        .schema("governance")
        .from("conflict_items")
        .insert(
          parsed.items.map((item) => ({
            ...item,
            affects: item.affects ?? null,
            declaration_id: declaration.id,
            handling: item.handling ?? null,
            partner_id: item.partner_id ?? null,
          }))
        )
    );
  }
  return declaration.id;
};

// ── Officers ────────────────────────────────────────────────────────────────

export const signAgreement = async (
  client: Client,
  agreementId: string,
  partnerSignatory: string,
  signedDocumentPath: string
) =>
  unwrap(
    await client.schema("governance").rpc("sign_partner_agreement", {
      agreement_id: agreementId,
      partner_signatory: partnerSignatory,
      signed_document_path: signedDocumentPath,
    })
  );

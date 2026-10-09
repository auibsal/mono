import { z } from "zod";
import { type Client, unwrap } from "./client";

/**
 * Recognition (Bylaws B4): recorded service (Form F-16) and certificates
 * (Form F-28; Fellowship and Honorary Membership). Row Level Security and
 * the RPCs decide who may confirm, sign and revoke.
 */

/** B4.1: hours of recorded service in an academic year for a nomination. */
export const FELLOWSHIP_HOURS = 40;

export const certificateKinds = [
  "service",
  "fellowship",
  "honorary",
  "volunteer",
  "production",
  "partner",
] as const;

export type CertificateKind = (typeof certificateKinds)[number];

/** Kinds that need an adopted Council resolution (B4.2, B4.4). */
export const needsResolution = (kind: CertificateKind) =>
  kind === "fellowship" || kind === "honorary";

/** Kinds that record a role held over a period. */
export const recordsRole = (kind: CertificateKind) =>
  kind === "service" || kind === "production" || kind === "partner";

/** The academic year runs from September 1. */
export const academicYearStart = (on: Date = new Date()) => {
  const year =
    on.getUTCMonth() >= 8 ? on.getUTCFullYear() : on.getUTCFullYear() - 1;
  return `${year}-09-01`;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const optionalDate = z
  .union([z.iso.date(), z.literal("")])
  .transform((value) => value || null)
  .nullable()
  .optional();

/** One line of the Volunteer Hours Log (F-16). */
export const serviceEntrySchema = z.object({
  activity: z.string().trim().min(1).max(200),
  hours: z
    .number()
    .positive()
    .max(24)
    .refine((h) => Number.isInteger(h * 4), { message: "quarter_hours" }),
  occurred_on: z.iso.date(),
  programme_id: z.uuid().nullable().optional(),
  what: optionalText(1000),
});

export type ServiceEntryInput = z.input<typeof serviceEntrySchema>;

export const certificateSchema = z
  .object({
    citation_ar: optionalText(500),
    citation_en: optionalText(500),
    hours: z.number().positive().nullable().optional(),
    kind: z.enum(certificateKinds),
    partner_id: z.uuid().nullable().optional(),
    period_from: optionalDate,
    period_to: optionalDate,
    resolution_id: z.uuid().nullable().optional(),
    role_ar: optionalText(200),
    role_en: optionalText(200),
    user_id: z.uuid(),
  })
  .superRefine((c, ctx) => {
    if (recordsRole(c.kind) && !(c.role_en && c.period_from)) {
      ctx.addIssue({
        code: "custom",
        message: "role_and_period",
        path: ["role_en"],
      });
    }
    if (needsResolution(c.kind) && !(c.citation_en && c.resolution_id)) {
      ctx.addIssue({
        code: "custom",
        message: "citation_and_resolution",
        path: ["resolution_id"],
      });
    }
    if (c.kind === "volunteer" && !c.hours) {
      ctx.addIssue({ code: "custom", message: "hours", path: ["hours"] });
    }
    if (c.kind === "partner" && !c.partner_id) {
      ctx.addIssue({
        code: "custom",
        message: "partner",
        path: ["partner_id"],
      });
    }
    if (c.period_from && c.period_to && c.period_to < c.period_from) {
      ctx.addIssue({
        code: "custom",
        message: "ends_before_start",
        path: ["period_to"],
      });
    }
  });

export type CertificateInput = z.input<typeof certificateSchema>;

const TRAILING_SLASH = /\/$/;

/** Where a certificate is checked: auibsal.org/<locale>/verify/<code>. */
export const verificationUrl = (
  webHost: string,
  locale: string,
  code: string
) => `${webHost.replace(TRAILING_SLASH, "")}/${locale}/verify/${code}`;

/**
 * LinkedIn's "Add to profile" link for a certification. Opens LinkedIn with
 * the fields filled in; nothing is sent until the member saves it.
 */
export const linkedInUrl = (input: {
  issuedAt: string;
  name: string;
  serial: string;
  url: string;
}) => {
  const issued = new Date(input.issuedAt);
  const params = new URLSearchParams({
    certId: input.serial,
    certUrl: input.url,
    issueMonth: String(issued.getUTCMonth() + 1),
    issueYear: String(issued.getUTCFullYear()),
    name: input.name,
    organizationName: "AUIB Society of Arts and Letters",
    startTask: "CERTIFICATION_NAME",
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
};

// ── Members ─────────────────────────────────────────────────────────────────

export const myService = async (client: Client) =>
  unwrap(
    await client
      .schema("membership")
      .from("service_records")
      .select(
        "id, source, programme_id, occurred_on, activity, what, hours, status, reject_reason, confirmed_at"
      )
      .eq("user_id", (await client.auth.getUser()).data.user?.id ?? "")
      .order("occurred_on", { ascending: false })
  ) ?? [];

export const logHours = async (client: Client, input: ServiceEntryInput) => {
  const entry = serviceEntrySchema.parse(input);
  return unwrap(
    await client
      .schema("membership")
      .from("service_records")
      .insert({
        activity: entry.activity,
        hours: entry.hours,
        occurred_on: entry.occurred_on,
        programme_id: entry.programme_id ?? null,
        what: entry.what ?? null,
      })
  );
};

/** Confirmed hours this academic year (the caller's own by default). */
export const serviceHours = async (client: Client, userId?: string) =>
  Number(
    unwrap(
      await client
        .schema("membership")
        .rpc("service_hours", userId ? { uid: userId } : {})
    ) ?? 0
  );

export const myCertificates = async (client: Client) =>
  unwrap(
    await client
      .schema("membership")
      .from("certificates")
      .select("*")
      .eq("user_id", (await client.auth.getUser()).data.user?.id ?? "")
      .neq("status", "draft")
      .order("issued_at", { ascending: false })
  ) ?? [];

export const certificateSigners = async (
  client: Client,
  certificateId: string
) =>
  unwrap(
    await client
      .schema("membership")
      .rpc("certificate_signers", { certificate_id: certificateId })
  )?.[0] ?? null;

// ── Officers ────────────────────────────────────────────────────────────────

export const confirmService = async (
  client: Client,
  recordId: string,
  approve: boolean,
  reason?: string
) =>
  unwrap(
    await client.schema("membership").rpc("confirm_service", {
      approve,
      reason: reason ?? undefined,
      record_id: recordId,
    })
  );

export const recordShiftService = async (
  client: Client,
  shiftId: string,
  memberId: string
) =>
  unwrap(
    await client
      .schema("membership")
      .rpc("record_shift_service", { member_id: memberId, shift_id: shiftId })
  );

export const recordEventService = async (
  client: Client,
  eventId: string,
  memberId: string,
  hours: number
) =>
  unwrap(
    await client.schema("membership").rpc("record_event_service", {
      event_id: eventId,
      hours,
      member_id: memberId,
    })
  );

export const serviceTotals = async (client: Client) =>
  unwrap(await client.schema("membership").rpc("service_totals")) ?? [];

/** Signs or countersigns; returns "issued" once both have signed. */
export const signCertificate = async (client: Client, certificateId: string) =>
  unwrap(
    await client
      .schema("membership")
      .rpc("sign_certificate", { certificate_id: certificateId })
  ) as "signed" | "issued";

export const revokeCertificate = async (
  client: Client,
  certificateId: string,
  reason: string
) =>
  unwrap(
    await client.schema("membership").rpc("revoke_certificate", {
      certificate_id: certificateId,
      reason,
    })
  );

// ── Public ──────────────────────────────────────────────────────────────────

export const verifyCertificate = async (client: Client, code: string) =>
  unwrap(
    await client.schema("membership").rpc("verify_certificate", { code })
  )?.[0] ?? null;

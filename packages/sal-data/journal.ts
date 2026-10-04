import { Constants, type Enums } from "@repo/database";
import { z } from "zod";
import { type Client, unwrap } from "./client";
import { sanitizeRichText } from "./sanitize";

/** The seven Waraq categories: one list for the form and the database enum. */
export const categories = Constants.journal.Enums.category;
export type Category = Enums<{ schema: "journal" }, "category">;

export const submissionStatuses = Constants.journal.Enums.submission_status;
export type SubmissionStatus = Enums<{ schema: "journal" }, "submission_status">;

/** Board columns, in order (Accepted, Declined and Withdrawn share the last). */
export const boardColumns = [
  "received",
  "intake_check",
  "in_review",
  "third_read",
  "selection",
] as const satisfies readonly SubmissionStatus[];

export const finalStatuses = ["accepted", "declined", "withdrawn"] as const satisfies readonly SubmissionStatus[];

/**
 * Rubric v2. Each criterion 1–5, weighted to a total out of 100 — the same
 * limits and weights as journal.scores (check constraints and the generated
 * `total` column).
 */
export const rubric = {
  archive_factor: { max: 5, min: 1, weight: 20 },
  craft: { max: 5, min: 1, weight: 30 },
  depth: { max: 5, min: 1, weight: 25 },
  voice: { max: 5, min: 1, weight: 25 },
} as const;

export type Criterion = keyof typeof rubric;
export const criteria = ["craft", "voice", "depth", "archive_factor"] as const satisfies readonly Criterion[];

const criterion = (key: Criterion) =>
  z.number().int().min(rubric[key].min).max(rubric[key].max);

export const scoreSchema = z.object({
  archive_factor: criterion("archive_factor"),
  comment: z.string().max(4000).optional(),
  craft: criterion("craft"),
  depth: criterion("depth"),
  voice: criterion("voice"),
});

export type ScoreInput = z.infer<typeof scoreSchema>;

/** Same formula as the database: score × weight ÷ 5. */
export const rubricTotal = (score: Pick<ScoreInput, Criterion>) =>
  criteria.reduce((sum, key) => sum + (score[key] * rubric[key].weight) / rubric[key].max, 0);

/** Third read when the two blind reads differ by more than this. */
export const THIRD_READ_SPREAD = 20;

export const needsThirdRead = (first: number, second: number) =>
  Math.abs(first - second) > THIRD_READ_SPREAD;

export type Band = "strong" | "consider" | "decline";

/** Bands: 80+ strong, 65–79 consider, below 65 decline. */
export const band = (total: number): Band => {
  if (total >= 80) {
    return "strong";
  }
  return total >= 65 ? "consider" : "decline";
};

export const MAX_SUBMISSIONS_PER_CALL = 2;
export const MAX_SUBMISSIONS_PER_HOUR = 3;

export const submissionFileTypes = {
  image: ["image/jpeg", "image/png"],
  manuscript: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const submissionSchema = z
  .object({
    body_html: z.string().max(200_000).optional(),
    call_id: z.uuid(),
    category: z.enum(categories),
    cover_note: z.string().max(2000).optional(),
    human_authorship_confirmed: z.literal(true),
    language: z.enum(Constants.journal.Enums.language),
    rights_note: z.string().max(2000).optional(),
    source_author: z.string().max(300).optional(),
    source_text: z.string().max(200_000).optional(),
    title: z.string().trim().min(1).max(300),
  })
  .superRefine((value, context) => {
    if (value.category === "translation") {
      if (!value.source_text?.trim()) {
        context.addIssue({ code: "custom", message: "source_required", path: ["source_text"] });
      }
      if (!value.rights_note?.trim()) {
        context.addIssue({ code: "custom", message: "rights_required", path: ["rights_note"] });
      }
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

/** A random object name for the private bucket: <submission id>/<random>.<ext>. */
export const submissionObjectPath = (submissionId: string, mimeType: string) => {
  const ext =
    {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "image/jpeg": "jpg",
      "image/png": "png",
    }[mimeType] ?? "bin";
  return `${submissionId}/${crypto.randomUUID()}.${ext}`;
};

// ── Queries ─────────────────────────────────────────────────────────────────

const journal = (client: Client) => client.schema("journal");

export const createSubmission = async (client: Client, input: SubmissionInput) =>
  unwrap(
    await journal(client)
      .from("submissions")
      .insert({ ...input, body_html: input.body_html ? sanitizeRichText(input.body_html) : null })
      .select("id")
      .single()
  );

export const mySubmissions = async (client: Client) =>
  unwrap(
    await journal(client)
      .from("submissions")
      .select("id, title, category, status, created_at, call_id, intake_note, intake_returned_at")
      .order("created_at", { ascending: false })
  );

export const openCalls = async (client: Client, now = new Date()) =>
  unwrap(
    await journal(client)
      .from("calls")
      .select("*")
      .lte("opens_at", now.toISOString())
      .gte("closes_at", now.toISOString())
      .order("closes_at")
  );

export const publishedIssues = async (client: Client) =>
  unwrap(
    await journal(client)
      .from("issues")
      .select("*")
      .order("volume", { ascending: false })
      .order("number", { ascending: false })
  );

export const latestPieces = async (client: Client, limit = 6) =>
  unwrap(
    await journal(client)
      .from("pieces")
      .select("id, slug, title_en, title_ar, category, language, members_only, published_at, contributor:contributors(slug, name_en, name_ar)")
      .order("published_at", { ascending: false })
      .limit(limit)
  );

export const transition = async (client: Client, id: string, to: SubmissionStatus, note?: string) =>
  unwrap(await journal(client).rpc("transition_submission", { id, note, to_status: to }));

export const submitScore = async (client: Client, assignmentId: string, input: ScoreInput) => {
  const score = scoreSchema.parse(input);
  return unwrap(
    await journal(client)
      .from("scores")
      .upsert({ assignment_id: assignmentId, ...score }, { onConflict: "assignment_id" })
      .select("total")
      .single()
  );
};

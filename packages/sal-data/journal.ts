import { Constants, type Enums } from "@repo/database";
import { z } from "zod";
import { type Client, unwrap } from "./client";
import { sanitizeRichText } from "./sanitize";

/** The seven Journal categories: one list for the form and the database enum. */
export const categories = Constants.journal.Enums.category;
export type Category = Enums<{ schema: "journal" }, "category">;

export const submissionStatuses = Constants.journal.Enums.submission_status;
export type SubmissionStatus = Enums<
  { schema: "journal" },
  "submission_status"
>;

/** Board columns, in order (Accepted, Declined and Withdrawn share the last). */
export const boardColumns = [
  "received",
  "intake_check",
  "in_review",
  "third_read",
  "selection",
] as const satisfies readonly SubmissionStatus[];

export const finalStatuses = [
  "accepted",
  "declined",
  "withdrawn",
] as const satisfies readonly SubmissionStatus[];

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
export const criteria = [
  "craft",
  "voice",
  "depth",
  "archive_factor",
] as const satisfies readonly Criterion[];

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
  criteria.reduce(
    (sum, key) => sum + (score[key] * rubric[key].weight) / rubric[key].max,
    0
  );

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

/**
 * The moves editors make on the board, mirroring private.allowed_transition
 * for journal.manage / journal.decide (intake belongs to the Submissions
 * Manager; accepting and declining go through journal.decide).
 */
export const editorMoves: Partial<
  Record<SubmissionStatus, readonly SubmissionStatus[]>
> = {
  in_review: ["third_read", "selection"],
  selection: ["in_review"],
  third_read: ["selection"],
};

export const canEditorMove = (from: SubmissionStatus, to: SubmissionStatus) =>
  editorMoves[from]?.includes(to) ?? false;

/** Mean of the submitted read totals (rounded to one place), or null. */
export const averageTotal = (
  totals: readonly (number | null | undefined)[]
) => {
  const scored = totals.filter(
    (total): total is number => typeof total === "number"
  );
  if (scored.length === 0) {
    return null;
  }
  const mean = scored.reduce((sum, total) => sum + total, 0) / scored.length;
  return Math.round(mean * 10) / 10;
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
    /** The partner the author submits through (partner pathway). */
    partner_id: z.uuid().optional(),
    rights_note: z.string().max(2000).optional(),
    source_author: z.string().max(300).optional(),
    source_text: z.string().max(200_000).optional(),
    title: z.string().trim().min(1).max(300),
  })
  .superRefine((value, context) => {
    if (value.category === "translation") {
      if (!value.source_text?.trim()) {
        context.addIssue({
          code: "custom",
          message: "source_required",
          path: ["source_text"],
        });
      }
      if (!value.rights_note?.trim()) {
        context.addIssue({
          code: "custom",
          message: "rights_required",
          path: ["rights_note"],
        });
      }
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

/** A random object name for the private bucket: <submission id>/<random>.<ext>. */
export const submissionObjectPath = (
  submissionId: string,
  mimeType: string
) => {
  const ext =
    {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "image/jpeg": "jpg",
      "image/png": "png",
    }[mimeType] ?? "bin";
  return `${submissionId}/${crypto.randomUUID()}.${ext}`;
};

// ── Queries ─────────────────────────────────────────────────────────────────

const journal = (client: Client) => client.schema("journal");

export const createSubmission = async (
  client: Client,
  input: SubmissionInput
) =>
  unwrap(
    await journal(client)
      .from("submissions")
      .insert({
        ...input,
        body_html: input.body_html ? sanitizeRichText(input.body_html) : null,
      })
      .select("id")
      .single()
  );

export const mySubmissions = async (client: Client) =>
  unwrap(
    await journal(client)
      .from("submissions")
      .select(
        "id, title, category, status, created_at, call_id, intake_note, intake_returned_at"
      )
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

/**
 * The partner pathway: calls the caller may answer through a partner they
 * are verified with (the partner's memorandum grants Journal submissions).
 */
export const myCallPathways = async (client: Client) =>
  unwrap(await journal(client).rpc("my_call_pathways")) ?? [];

/** Partners named on a published call (listed partners only). */
export const callPartnerNames = async (client: Client, callId: string) =>
  unwrap(
    await journal(client).rpc("call_partner_names", { call_id: callId })
  ) ?? [];

/** Partners a Journal manager may open a call to. */
export const submissionPartners = async (client: Client) =>
  unwrap(await journal(client).rpc("submission_partners")) ?? [];

/** The partners a call is open to (Journal managers). */
export const callPartnerIds = async (client: Client, callId: string) =>
  (
    unwrap(
      await journal(client)
        .from("call_partners")
        .select("partner_id")
        .eq("call_id", callId)
    ) ?? []
  ).map((row) => row.partner_id);

export const setCallPartners = async (
  client: Client,
  callId: string,
  partnerIds: readonly string[]
) => {
  const current = await callPartnerIds(client, callId);
  const add = partnerIds.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !partnerIds.includes(id));
  if (add.length > 0) {
    unwrap(
      await journal(client)
        .from("call_partners")
        .insert(add.map((partner_id) => ({ call_id: callId, partner_id })))
    );
  }
  if (remove.length > 0) {
    unwrap(
      await journal(client)
        .from("call_partners")
        .delete()
        .eq("call_id", callId)
        .in("partner_id", remove)
    );
  }
};

/** Published calls that have not opened yet: announced ahead of time. */
export const upcomingCalls = async (client: Client, now = new Date()) =>
  unwrap(
    await journal(client)
      .from("calls")
      .select("*")
      .gt("opens_at", now.toISOString())
      .order("opens_at")
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
      .select(
        "id, slug, title_en, title_ar, category, language, members_only, published_at, contributor:contributors(slug, name_en, name_ar)"
      )
      .order("published_at", { ascending: false })
      .limit(limit)
  );

export const transition = async (
  client: Client,
  id: string,
  to: SubmissionStatus,
  note?: string
) =>
  unwrap(
    await journal(client).rpc("transition_submission", {
      id,
      note,
      to_status: to,
    })
  );

export const submitScore = async (
  client: Client,
  assignmentId: string,
  input: ScoreInput
) => {
  const score = scoreSchema.parse(input);
  return unwrap(
    await journal(client)
      .from("scores")
      .upsert(
        { assignment_id: assignmentId, ...score },
        { onConflict: "assignment_id" }
      )
      .select("total")
      .single()
  );
};

// ── Published Journal (public site) ───────────────────────────────────────────
// Each query also filters to published rows, so a signed-in editor's client
// would not show drafts either; RLS is still the boundary.

const pieceListColumns =
  "id, slug, title_en, title_ar, category, language, members_only, published_at, sort, contributor:contributors(slug, name_en, name_ar)";

const published = <
  T extends {
    lte: (c: string, v: string) => T;
    eq: (c: string, v: string) => T;
  },
>(
  query: T
) =>
  query.eq("status", "published").lte("published_at", new Date().toISOString());

export const issueBySlug = async (client: Client, slug: string) =>
  unwrap(
    await published(
      journal(client).from("issues").select("*").eq("slug", slug)
    ).maybeSingle()
  );

export const piecesInIssue = async (client: Client, issueId: string) =>
  unwrap(
    await published(
      journal(client)
        .from("pieces")
        .select(pieceListColumns)
        .eq("issue_id", issueId)
    ).order("sort")
  ) ?? [];

/** A piece and its text. Members-only text is withheld by RLS (body null). */
export const pieceBySlug = async (client: Client, slug: string) => {
  const piece = unwrap(
    await published(
      journal(client)
        .from("pieces")
        .select(
          `${pieceListColumns}, credit_en, credit_ar, image_path, issue:issues(slug, volume, number, title_en, title_ar)`
        )
        .eq("slug", slug)
    ).maybeSingle()
  );
  if (!piece) {
    return null;
  }
  const body = unwrap(
    await journal(client)
      .from("piece_bodies")
      .select("body_en, body_ar")
      .eq("piece_id", piece.id)
      .maybeSingle()
  );
  return { ...piece, body };
};

export const contributorBySlug = async (client: Client, slug: string) => {
  const contributor = unwrap(
    await journal(client)
      .from("contributors")
      .select("id, slug, name_en, name_ar, bio_en, bio_ar")
      .eq("slug", slug)
      .maybeSingle()
  );
  if (!contributor) {
    return null;
  }
  const pieces =
    unwrap(
      await published(
        journal(client)
          .from("pieces")
          .select(pieceListColumns)
          .eq("contributor_id", contributor.id)
      ).order("published_at", { ascending: false })
    ) ?? [];
  return { ...contributor, pieces };
};

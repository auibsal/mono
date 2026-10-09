import { type Client, unwrap } from "./client";

/**
 * Forms filled in the Nexus (Templates & Forms, SAL-OPS-02). Each form's
 * fields are transcribed from the printed form; labels live in the
 * messages files under `nexus.forms.defs.<key>`. Who may fill a form in
 * and who handles it is `governance.form_types` (the database decides).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "date"
  | "datetime"
  | "number"
  | "iqd"
  | "choice"
  | "multi"
  | "check"
  | "table"
  | "grid";

export interface FormField {
  /** For `grid`: the columns. For `table`: the columns of each row. */
  readonly columns?: readonly FormField[];
  readonly key: string;
  readonly max?: number;
  readonly min?: number;
  /** For `choice` and `multi`. */
  readonly options?: readonly string[];
  readonly required?: boolean;
  /** For `grid`: the fixed rows. */
  readonly rows?: readonly string[];
  readonly type: FieldType;
}

export interface FormDefinition {
  /** May be sent without a name (F-20). */
  readonly anonymous?: boolean;
  readonly code: string;
  readonly fields: readonly FormField[];
  readonly key: FormKey;
  /** "Office use" boxes, kept by the handlers. */
  readonly office?: readonly FormField[];
  /** Shows the printed text (a release, a declaration) above the fields. */
  readonly preamble?: boolean;
  /** Asks who the concern is about, for routing (F-20). */
  readonly routing?: boolean;
  /** Names the person the form is about (a member). */
  readonly subject?: boolean;
}

export const formKeys = [
  "f03",
  "f04",
  "f06",
  "f09",
  "f10",
  "f11",
  "f13",
  "f14",
  "f17",
  "f19",
  "f20",
  "f24",
  "f25a",
  "f27",
  "f29",
] as const;

export type FormKey = (typeof formKeys)[number];

export const formStatuses = [
  "draft",
  "submitted",
  "acknowledged",
  "in_progress",
  "closed",
] as const;

export type FormStatus = (typeof formStatuses)[number];

export const routings = ["none", "vice_president", "president"] as const;
export type Routing = (typeof routings)[number];

const text = (key: string, required = false, max = 200): FormField => ({
  key,
  max,
  required,
  type: "text",
});
const long = (key: string, required = false, max = 2000): FormField => ({
  key,
  max,
  required,
  type: "textarea",
});
const check = (key: string, required = false): FormField => ({
  key,
  required,
  type: "check",
});
const date = (key: string, required = false): FormField => ({
  key,
  required,
  type: "date",
});
const count = (key: string, required = false, max = 100_000): FormField => ({
  key,
  max,
  min: 0,
  required,
  type: "number",
});
const iqd = (key: string, required = false): FormField => ({
  key,
  min: 0,
  required,
  type: "iqd",
});
const choice = (
  key: string,
  options: readonly string[],
  required = false
): FormField => ({ key, options, required, type: "choice" });
const multi = (
  key: string,
  options: readonly string[],
  required = false
): FormField => ({ key, options, required, type: "multi" });
const score = (key: string): FormField => ({
  key,
  max: 5,
  min: 1,
  required: true,
  type: "number",
});

const PILLARS = ["connecting", "creativity", "culture", "community"] as const;

/** F-04: criterion weights (percent). */
export const interviewWeights = {
  score_commitment: 20,
  score_ideas: 20,
  score_skills: 25,
  score_teamwork: 20,
  score_values: 15,
} as const;

/** F-14: banknotes counted, in IQD. */
export const banknotes = [
  "50000",
  "25000",
  "10000",
  "5000",
  "1000",
  "500",
  "250",
] as const;

export const forms: Record<FormKey, FormDefinition> = {
  f03: {
    code: "F-03",
    fields: [
      text("first_choice", true),
      text("second_choice"),
      text("college_year", true),
      count("hours", true, 60),
      long("commitments", false, 1000),
      long("why", true, 1500),
      long("experience", true, 1500),
      { key: "work_link", max: 500, type: "url" },
      multi("interview_days", ["tue", "wed", "thu", "any"]),
      check("decl_true", true),
      check("decl_read", true),
      check("decl_apprenticeship", true),
    ],
    key: "f03",
  },
  f04: {
    code: "F-04",
    fields: [
      text("candidate", true),
      text("role", true),
      score("score_commitment"),
      score("score_skills"),
      score("score_ideas"),
      score("score_teamwork"),
      score("score_values"),
      long("notes"),
      choice(
        "recommendation",
        ["appoint", "other_role", "not_this_time"],
        true
      ),
      text("other_role"),
      choice("conflict", ["none", "declared"], true),
      text("conflict_what"),
    ],
    key: "f04",
  },
  f06: {
    code: "F-06",
    fields: [
      text("role", true),
      date("start_date", true),
      multi("first_week", [
        "accepted",
        "pledge_coi",
        "coffee",
        "role_card",
        "playbook",
        "groups",
        "drive",
        "dossier_walkthrough",
        "roster",
        "first_task",
      ]),
      multi("first_month", [
        "two_meetings",
        "shadowed",
        "work_plan",
        "dossier_started",
        "treasurer",
        "cashier",
        "media_consent",
        "announced",
      ]),
      check("signed_holder"),
      check("signed_director"),
    ],
    key: "f06",
    subject: true,
  },
  f09: {
    code: "F-09",
    fields: [
      text("seconder", true),
      text("title", true),
      long("notes", true),
      long("believes", true),
      long("resolves", true),
      choice(
        "motion_type",
        ["ordinary", "amendment", "overturn", "removal"],
        true
      ),
    ],
    key: "f09",
  },
  f10: {
    code: "F-10",
    fields: [
      text("director"),
      text("name", true),
      long("idea", true, 800),
      multi("pillars", PILLARS),
      long("helpers", false, 800),
      long("audience", false, 800),
      text("when"),
      text("where"),
      iqd("cost"),
      long("risks"),
      long("success"),
    ],
    key: "f10",
    office: [
      date("received"),
      date("at_council"),
      choice("outcome", ["greenlit", "not_yet"]),
      check("reasons_sent"),
      check("charter"),
    ],
  },
  f11: {
    code: "F-11",
    fields: [
      text("event", true),
      text("lead", true),
      { key: "starts_at", required: true, type: "datetime" },
      text("location", true),
      count("attendance"),
      text("student_life_ref"),
      {
        columns: [
          check("na"),
          text("what", false, 300),
          choice("level", ["low", "medium", "high"]),
          text("plan", false, 300),
        ],
        key: "risks",
        rows: [
          "crowding",
          "cash",
          "equipment",
          "food",
          "guests",
          "photography",
          "sensitive",
          "vulnerable",
          "travel",
          "weather",
        ],
        type: "grid",
      },
      multi("t7", [
        "approvals",
        "room",
        "kit",
        "volunteers",
        "cash_plan",
        "stickers",
        "exits",
        "contacts",
      ]),
      text("student_life_contact"),
      text("security_contact"),
      text("first_aid"),
    ],
    key: "f11",
    office: [check("approved")],
  },
  f13: {
    code: "F-13",
    fields: [
      text("phone", false, 40),
      text("department", true),
      text("budget_line", true),
      text("approved_by", true),
      {
        columns: [
          date("date", true),
          text("item", true),
          text("shop"),
          text("receipt"),
          iqd("amount", true),
        ],
        key: "items",
        max: 30,
        required: true,
        type: "table",
      },
      text("payment", true, 300),
      check("receipts_attached", true),
      check("not_self_approved", true),
      check("inventory"),
    ],
    key: "f13",
    office: [
      text("checked_by"),
      date("paid_on"),
      iqd("amount"),
      text("ledger_ref"),
    ],
  },
  f14: {
    code: "F-14",
    fields: [
      text("event", true),
      date("date", true),
      choice("count_type", ["float", "close", "day"], true),
      choice("money_type", ["society", "charity"], true),
      {
        columns: [count("count1"), count("count2")],
        key: "notes",
        rows: banknotes,
        type: "grid",
      },
      iqd("opening_float"),
      iqd("sales_recorded"),
      iqd("expected_total"),
      text("difference_reason", false, 500),
      text("seal_no"),
      text("handed_to"),
      text("handed_at", false, 40),
      text("counter2", true),
      text("received_by"),
    ],
    key: "f14",
  },
  f17: {
    code: "F-17",
    fields: [
      text("event", true),
      date("date", true),
      choice("credit", ["name", "no_name"], true),
      check("photos_only"),
      text("contact"),
      check("under_18"),
      text("guardian"),
      check("agree", true),
    ],
    key: "f17",
    preamble: true,
  },
  f19: {
    code: "F-19",
    fields: [
      text("event", true),
      { key: "occurred_at", required: true, type: "datetime" },
      text("location", true),
      text("role"),
      text("phone", false, 40),
      multi(
        "types",
        ["injury", "damage", "safety", "behaviour", "money", "media", "other"],
        true
      ),
      long("what", true, 4000),
      long("done", true),
      long("told"),
      long("witnesses"),
      long("follow_up"),
    ],
    key: "f19",
    office: [check("student_life"), check("advisor_told")],
    preamble: true,
  },
  f20: {
    anonymous: true,
    code: "F-20",
    fields: [
      text("contact"),
      choice(
        "about",
        ["person", "event", "money", "content", "decision", "other"],
        true
      ),
      long("what", true, 4000),
      long("wanted", true),
      choice("would_like", ["informal", "formal", "just_know"]),
    ],
    key: "f20",
    office: [choice("route", ["informal", "conduct_panel", "student_life"])],
    preamble: true,
    routing: true,
  },
  f24: {
    code: "F-24",
    fields: [
      text("role", true),
      long("role_paragraph", false, 3000),
      long("contacts", false, 3000),
      long("accounts", false, 3000),
      long("open_items", false, 3000),
      long("money", false, 3000),
      long("files", false, 3000),
      long("lessons", false, 3000),
    ],
    key: "f24",
    subject: true,
  },
  f25a: {
    code: "F-25 A",
    fields: [
      text("semester", true),
      count("members_registered"),
      count("members_voting"),
      count("members_new"),
      count("members_retained"),
      count("events"),
      count("attendance"),
      count("volunteer_hours"),
      iqd("budget"),
      iqd("spent"),
      iqd("balance"),
      iqd("charity_handed"),
      count("seats_filled"),
      count("seats_total"),
      count("vacancies"),
      long("highlights", false, 3000),
      long("risks", false, 3000),
    ],
    key: "f25a",
  },
  f27: {
    code: "F-27",
    fields: [
      text("role", true),
      date("last_day", true),
      multi("items", [
        "dossier",
        "files",
        "data_deleted",
        "groups",
        "drive",
        "admin_rights",
        "passwords",
        "returned",
        "claims",
        "exit_conversation",
        "hours",
        "thanks",
        "roster",
        "invited",
      ]),
      long("exit", false, 3000),
      check("signed_leaving"),
      check("signed_gs"),
    ],
    key: "f27",
    subject: true,
  },
  f29: {
    code: "F-29",
    fields: [
      text("programme", true),
      date("charter_date"),
      date("review_date"),
      long("purpose", true, 800),
      multi("pillars", PILLARS),
      text("lead"),
      text("deputy"),
      text("reports_to"),
      long("team"),
      iqd("budget"),
      text("frequency"),
      check("standing"),
      long("key_dates"),
      long("success"),
      long("independence"),
      long("documents"),
    ],
    key: "f29",
  },
};

/**
 * Forms that live in their own part of the platform. Paths are Nexus
 * routes.
 */
export const formsElsewhere = [
  { code: "F-01", key: "f01", path: "/profile" },
  { code: "F-02", key: "f02", path: "/profile" },
  { code: "F-07", key: "f07", path: "/admin/governance" },
  { code: "F-08", key: "f08", path: "/admin/governance" },
  { code: "F-12", key: "f12", path: "/admin/governance" },
  { code: "F-15", key: "f15", path: "/admin/events" },
  { code: "F-16", key: "f16", path: "/service" },
  { code: "F-18", key: "f18", path: "/declarations" },
  { code: "F-21", key: "f21", path: "/society" },
  { code: "F-22", key: "f22", path: "/society" },
  { code: "F-23", key: "f23", path: "/society" },
  { code: "F-25 B", key: "f25b", path: "/admin/productions" },
  { code: "F-26", key: "f26", path: "/admin/partners" },
  { code: "F-28", key: "f28", path: "/service" },
] as const;

export const isFormKey = (value: string | null): value is FormKey =>
  (formKeys as readonly string[]).includes(value ?? "");

// ── Values and checks ───────────────────────────────────────────────────────

export type FormData = Record<string, unknown>;

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === "" ||
  value === false ||
  (Array.isArray(value) && value.length === 0);

const tooLong = (field: FormField, value: unknown) =>
  typeof value === "string" &&
  field.max !== undefined &&
  (field.type === "text" ||
    field.type === "textarea" ||
    field.type === "url") &&
  value.length > field.max;

const outOfRange = (field: FormField, value: unknown) => {
  if (!(field.type === "number" || field.type === "iqd")) {
    return false;
  }
  if (isBlank(value)) {
    return false;
  }
  const n = Number(value);
  return (
    !Number.isFinite(n) ||
    (field.min !== undefined && n < field.min) ||
    (field.max !== undefined && n > field.max)
  );
};

const URL_PATTERN = /^https?:\/\//;

const badChoice = (field: FormField, value: unknown) => {
  if (isBlank(value)) {
    return false;
  }
  if (field.type === "choice") {
    return !field.options?.includes(String(value));
  }
  if (field.type === "multi") {
    return (
      !Array.isArray(value) ||
      value.some((v) => !field.options?.includes(String(v)))
    );
  }
  if (field.type === "url") {
    return !URL_PATTERN.test(String(value));
  }
  return false;
};

const rowProblems = (field: FormField, value: unknown) => {
  if (field.type !== "table" || !Array.isArray(value)) {
    return false;
  }
  if (field.max !== undefined && value.length > field.max) {
    return true;
  }
  return value.some((row) => {
    const cells = (row ?? {}) as FormData;
    return (field.columns ?? []).some(
      (col) =>
        (col.required && isBlank(cells[col.key])) ||
        outOfRange(col, cells[col.key])
    );
  });
};

/** The keys of fields that are missing or invalid (empty when it's fine). */
export const formProblems = (
  definition: FormDefinition,
  data: FormData
): string[] =>
  definition.fields
    .filter((field) => {
      const value = data[field.key];
      return (
        (field.required && isBlank(value)) ||
        tooLong(field, value) ||
        outOfRange(field, value) ||
        badChoice(field, value) ||
        rowProblems(field, value)
      );
    })
    .map((field) => field.key);

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** F-04: Σ (score × weight) ÷ 5, out of 100. */
export const interviewTotal = (data: FormData) =>
  Math.round(
    Object.entries(interviewWeights).reduce(
      (sum, [key, weight]) => sum + num(data[key]) * weight,
      0
    ) / 5
  );

/** F-04: a 1 on Commitment or Teamwork means no, whatever the total. */
export const interviewVeto = (data: FormData) =>
  num(data.score_commitment) === 1 || num(data.score_teamwork) === 1;

/** F-13: the total claimed. */
export const claimTotal = (data: FormData) =>
  (Array.isArray(data.items) ? data.items : []).reduce(
    (sum: number, row) => sum + num(((row ?? {}) as FormData).amount),
    0
  );

/** F-14: each count's total value. */
export const cashTotals = (data: FormData) => {
  const grid = (data.notes ?? {}) as Record<string, FormData>;
  return banknotes.reduce(
    (totals, note) => ({
      count1: totals.count1 + num(grid[note]?.count1) * Number(note),
      count2: totals.count2 + num(grid[note]?.count2) * Number(note),
    }),
    { count1: 0, count2: 0 }
  );
};

// ── Reads and writes ────────────────────────────────────────────────────────

export interface SaveInput {
  anonymous?: boolean;
  data: FormData;
  form: FormKey;
  id?: string | null;
  routing?: Routing;
  subjectId?: string | null;
  submit: boolean;
}

export const saveForm = async (client: Client, input: SaveInput) =>
  unwrap(
    await client.schema("governance").rpc("save_form", {
      anonymous: input.anonymous ?? false,
      data: input.data as never,
      form_key: input.form,
      routing: input.routing ?? "none",
      subject_id: input.subjectId ?? undefined,
      submission_id: input.id ?? undefined,
      submit: input.submit,
    })
  ) as string;

export const handleForm = async (
  client: Client,
  id: string,
  status: Exclude<FormStatus, "draft" | "submitted">,
  office?: FormData
) =>
  unwrap(
    await client.schema("governance").rpc("handle_form", {
      office: (office ?? undefined) as never,
      status,
      submission_id: id,
    })
  );

export const discardDraft = async (client: Client, id: string) =>
  unwrap(
    await client
      .schema("governance")
      .rpc("discard_form_draft", { submission_id: id })
  );

export const formTypes = async (client: Client) =>
  unwrap(
    await client
      .schema("governance")
      .from("form_types")
      .select("*")
      .order("sort")
  ) ?? [];

export const formQueue = async (client: Client) =>
  unwrap(await client.schema("governance").rpc("form_queue")) ?? [];

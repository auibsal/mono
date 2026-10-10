import { z } from "zod";
import { type Client, unwrap } from "./client";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const eventQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label_ar: z.string().min(1).max(200),
  label_en: z.string().min(1).max(200),
  required: z.boolean().default(false),
});

export const eventSchema = z
  .object({
    body_ar: z.string().optional(),
    body_en: z.string().optional(),
    capacity: z.number().int().positive().nullable(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    members_only: z.boolean(),
    programme_id: z.uuid().nullable(),
    questions: z.array(eventQuestionSchema).max(10).default([]),
    rsvp_enabled: z.boolean().default(true),
    slug,
    starts_at: z.iso.datetime({ offset: true }),
    status: z.enum(["draft", "published", "cancelled"]),
    summary_ar: z.string().max(500).optional(),
    summary_en: z.string().max(500).optional(),
    title_ar: z.string().trim().min(1).max(200),
    title_en: z.string().trim().min(1).max(200),
    venue_ar: z.string().optional(),
    venue_en: z.string().optional(),
  })
  .refine((e) => !e.ends_at || new Date(e.ends_at) > new Date(e.starts_at), {
    message: "ends_before_start",
    path: ["ends_at"],
  });

export type EventInput = z.infer<typeof eventSchema>;

const events = (client: Client) => client.schema("events");

export const eventColumns =
  "id, slug, programme_id, title_en, title_ar, summary_en, summary_ar, venue_en, venue_ar, starts_at, ends_at, members_only, capacity, rsvp_enabled, status, image_path";

/**
 * Public events. Members-only events are filtered here AND by RLS, so they
 * never reach a public page whichever client runs the query.
 */
export const publicEvents = async (
  client: Client,
  {
    from = new Date(),
    limit = 50,
    programmeId,
  }: { from?: Date; limit?: number; programmeId?: string } = {}
) => {
  let query = events(client)
    .from("events")
    .select(eventColumns)
    .eq("status", "published")
    .eq("members_only", false)
    .gte("starts_at", from.toISOString())
    .order("starts_at")
    .limit(limit);
  if (programmeId) {
    query = query.eq("programme_id", programmeId);
  }
  return unwrap(await query);
};

/** Public events that have started, most recent first. */
export const pastPublicEvents = async (
  client: Client,
  { before = new Date(), limit = 20 }: { before?: Date; limit?: number } = {}
) =>
  unwrap(
    await events(client)
      .from("events")
      .select(eventColumns)
      .eq("status", "published")
      .eq("members_only", false)
      .lt("starts_at", before.toISOString())
      .order("starts_at", { ascending: false })
      .limit(limit)
  );

export const publicEvent = async (client: Client, eventSlug: string) =>
  unwrap(
    await events(client)
      .from("events")
      .select(`${eventColumns}, body_en, body_ar, questions`)
      .eq("slug", eventSlug)
      .eq("members_only", false)
      .in("status", ["published", "cancelled"])
      .maybeSingle()
  );

export const rsvp = async (
  client: Client,
  eventId: string,
  answers: Record<string, string> = {}
) =>
  unwrap(await events(client).rpc("rsvp", { answers, event_id: eventId })) as
    | "already"
    | "confirmed"
    | "waitlisted";

export const cancelRsvp = async (client: Client, eventId: string) =>
  unwrap(await events(client).rpc("cancel_rsvp", { event_id: eventId }));

/** The member's own confirmed RSVPs (officers may read everyone's). */
export const myRsvps = async (client: Client, userId: string) =>
  unwrap(
    await events(client)
      .from("rsvps")
      .select(
        `id, status, ticket_code, from_waitlist, event:events(${eventColumns})`
      )
      .eq("status", "confirmed")
      .eq("user_id", userId)
  );

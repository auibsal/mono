import "server-only";

import type { Permission } from "@repo/rbac";
import { membership, unwrap } from "@repo/sal-data";
import { z } from "zod";
import type { ApiSession } from "./permissions";

/**
 * CSV exports for the Nexus admin. Each one runs as the caller (their JWT),
 * so Row Level Security and the SQL functions decide the rows; the
 * permission here is re-checked first, in any scope.
 */
export interface ExportTable {
  header: string[];
  rows: unknown[][];
}

export interface ExportDefinition {
  readonly permissions: readonly Permission[];
  readonly run: (
    session: ApiSession,
    params: Record<string, string>
  ) => Promise<ExportTable>;
}

const uuid = z.uuid();

/** Attendance for one event: RSVPs, answers and check-ins (RLS decides). */
const attendanceRows = async (
  session: ApiSession,
  params: Record<string, string>
) => {
  const eventId = uuid.parse(params.event_id);
  const db = session.supabase;
  const event = unwrap(
    await db
      .schema("events")
      .from("events")
      .select("questions")
      .eq("id", eventId)
      .maybeSingle()
  );
  if (!event) {
    throw new Error("Event not found or not visible to the caller");
  }
  const questions = (event.questions ?? []) as {
    id: string;
    label_en: string;
  }[];
  const [rsvps, checkIns] = await Promise.all([
    db
      .schema("events")
      .from("rsvps")
      .select("user_id, answers, created_at, from_waitlist")
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .order("created_at"),
    db
      .schema("events")
      .from("check_ins")
      .select("user_id, method, checked_in_at")
      .eq("event_id", eventId),
  ]);
  const rsvpRows = unwrap(rsvps) ?? [];
  const checkInRows = unwrap(checkIns) ?? [];
  const ids = [...new Set([...rsvpRows, ...checkInRows].map((r) => r.user_id))];
  const profiles = ids.length
    ? (unwrap(
        await db
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar")
          .in("id", ids)
      ) ?? [])
    : [];

  const rows = ids.map((id) => {
    const profile = profiles.find((p) => p.id === id);
    const rsvp = rsvpRows.find((r) => r.user_id === id);
    const checkIn = checkInRows.find((c) => c.user_id === id);
    const answers = (rsvp?.answers ?? {}) as Record<string, string>;
    return [
      profile?.full_name_en ?? "",
      profile?.full_name_ar ?? "",
      rsvp ? rsvp.created_at : "",
      rsvp?.from_waitlist ? "yes" : "no",
      checkIn ? checkIn.checked_in_at : "",
      checkIn?.method ?? "",
      ...questions.map((q) => answers[q.id] ?? ""),
    ];
  });
  return {
    header: [
      "name_en",
      "name_ar",
      "rsvp_at",
      "from_waitlist",
      "checked_in_at",
      "check_in_method",
      ...questions.map((q) => q.label_en),
    ],
    rows,
  };
};

export const exportsByName: Record<string, ExportDefinition> = {
  attendance: {
    permissions: ["events.manage", "events.checkin"],
    run: attendanceRows,
  },
  members: {
    permissions: ["members.manage", "members.verify", "roles.assign"],
    run: async (session) => ({
      header: [
        "name_en",
        "name_ar",
        "email",
        "tier",
        "member_since",
        "verified",
        "activities_this_and_last_semester",
        "voting_member",
      ],
      rows: (await membership.directory(session.supabase)).map((m) => [
        m.full_name_en,
        m.full_name_ar,
        m.email,
        m.tier,
        m.member_since,
        m.verified_at ? "yes" : "no",
        m.activities,
        m.voting_member ? "yes" : "no",
      ]),
    }),
  },
};

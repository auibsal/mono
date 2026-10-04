"use client";

import { useAuth } from "@repo/auth/provider";
import { readFlags } from "@repo/feature-flags";
import type { Grant } from "@repo/rbac";
import { journal, membership, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";

/**
 * Data hooks. Every query runs with the member's session, so Row Level
 * Security decides what comes back. Keys include the user so signing in as
 * someone else refetches.
 */
export const queryKeys = {
  activity: (userId: string) => ["activity", userId] as const,
  announcements: (userId: string) => ["announcements", userId] as const,
  calendarToken: (userId: string) => ["calendar-token", userId] as const,
  flags: ["flags"] as const,
  grants: (userId: string) => ["grants", userId] as const,
  openCalls: ["open-calls"] as const,
  profile: (userId: string) => ["profile", userId] as const,
  rsvps: (userId: string) => ["rsvps", userId] as const,
  shifts: (userId: string) => ["shifts", userId] as const,
  sixWords: (userId: string) => ["six-words", userId] as const,
  status: (userId: string) => ["status", userId] as const,
  submissions: (userId: string) => ["submissions", userId] as const,
  verification: (userId: string) => ["verification", userId] as const,
  waitlist: (userId: string) => ["waitlist", userId] as const,
};

const useUserQuery = <T>(
  key: (userId: string) => readonly unknown[],
  fn: (userId: string) => Promise<T>
) => {
  const { user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: () => fn(user?.id ?? ""),
    queryKey: key(user?.id ?? ""),
  });
};

export const useMemberStatus = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.status, () => membership.myStatus(supabase));
};

export const useProfile = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.profile, async (userId) =>
    unwrap(
      await supabase
        .schema("core")
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
    )
  );
};

/** The member's active grants (for showing admin modules; RLS still decides). */
export const useGrants = () => {
  const { supabase } = useAuth();
  return useUserQuery(
    queryKeys.grants,
    async () =>
      (unwrap(await supabase.schema("access").rpc("my_permissions")) ??
        []) as Grant[]
  );
};

export const useFlags = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: () => readFlags(supabase),
    queryKey: queryKeys.flags,
  });
};

export const useVerificationRequest = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.verification, async () =>
    unwrap(
      await supabase
        .schema("membership")
        .from("verification_requests")
        .select("id, status, statement, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
};

export const useActivity = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.activity, async () => {
    const records =
      unwrap(
        await supabase
          .schema("membership")
          .from("activity_records")
          .select("id, kind, occurred_at, note, event_id")
          .order("occurred_at", { ascending: false })
          .limit(20)
      ) ?? [];
    // Events live in another schema, so they can't be embedded.
    const ids = [
      ...new Set(
        records.map((r) => r.event_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const events = ids.length
      ? (unwrap(
          await supabase
            .schema("events")
            .from("events")
            .select("id, title_en, title_ar")
            .in("id", ids)
        ) ?? [])
      : [];
    return records.map((record) => ({
      ...record,
      event: events.find((event) => event.id === record.event_id) ?? null,
    }));
  });
};

export const useMyRsvps = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.rsvps, async () =>
    unwrap(
      await supabase
        .schema("events")
        .from("rsvps")
        .select(
          "id, ticket_code, from_waitlist, event:events(id, slug, title_en, title_ar, starts_at, ends_at, venue_en, venue_ar)"
        )
        .eq("status", "confirmed")
    )
  );
};

export const useMyWaitlist = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.waitlist, async () =>
    unwrap(
      await supabase
        .schema("events")
        .from("waitlist")
        .select("id, event:events(id, slug, title_en, title_ar, starts_at)")
        .eq("status", "waiting")
    )
  );
};

export const useAnnouncements = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.announcements, async () =>
    unwrap(
      await supabase
        .schema("content")
        .from("announcements")
        .select("id, title_en, title_ar, body_en, body_ar, link, starts_at")
        .order("starts_at", { ascending: false })
        .limit(10)
    )
  );
};

export const useOpenCalls = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: () => journal.openCalls(supabase),
    queryKey: queryKeys.openCalls,
  });
};

export const useMySubmissions = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.submissions, () =>
    journal.mySubmissions(supabase)
  );
};

export const useMyShifts = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.shifts, async () =>
    unwrap(
      await supabase
        .schema("programmes")
        .from("shift_signups")
        .select(
          "shift_id, status, shift:shifts(id, role_en, role_ar, starts_at, ends_at, location_en, location_ar)"
        )
        .neq("status", "cancelled")
    )
  );
};

export const useMySixWords = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.sixWords, async (userId) =>
    unwrap(
      await supabase
        .schema("programmes")
        .from("six_words")
        .select("id, text, language, status, show_name")
        .eq("user_id", userId)
        .maybeSingle()
    )
  );
};

export const useCalendarToken = () => {
  const { supabase } = useAuth();
  return useUserQuery(queryKeys.calendarToken, () =>
    membership.calendarToken(supabase)
  );
};

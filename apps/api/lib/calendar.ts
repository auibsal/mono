import "server-only";

import { project } from "@repo/config";
import type { AdminClient } from "@repo/database/admin";
import type { IcsEvent } from "./ics";

const eventColumns =
  "id, slug, title_en, title_ar, summary_en, venue_en, venue_ar, starts_at, ends_at, members_only";

interface EventRow {
  ends_at: string | null;
  id: string;
  members_only: boolean;
  slug: string;
  starts_at: string;
  summary_en: string | null;
  title_ar: string;
  title_en: string;
  venue_ar: string | null;
  venue_en: string | null;
}

const toIcs = (
  event: EventRow,
  locale: "en" | "ar",
  tag?: string
): IcsEvent => ({
  description: event.summary_en,
  end: event.ends_at,
  location:
    locale === "ar"
      ? (event.venue_ar ?? event.venue_en)
      : (event.venue_en ?? event.venue_ar),
  start: event.starts_at,
  tag,
  title: locale === "ar" ? event.title_ar : event.title_en,
  uid: `${event.id}@${project.domain}`,
  url: event.members_only
    ? `${project.hosts.app}/${locale}`
    : `${project.hosts.web}/${locale}/events/${event.slug}`,
});

const since = () => new Date(Date.now() - 90 * 86_400_000).toISOString();

/** Public SAL events (never members-only), for the public feed. */
export const publicEvents = async (admin: AdminClient, locale: "en" | "ar") => {
  const { data } = await admin
    .schema("events")
    .from("events")
    .select(eventColumns)
    .eq("status", "published")
    .eq("members_only", false)
    .gte("starts_at", since())
    .order("starts_at");
  return (data ?? []).map((event) => toIcs(event, locale));
};

/** One public event, for "Add to calendar". */
export const publicEvent = async (
  admin: AdminClient,
  slug: string,
  locale: "en" | "ar"
) => {
  const { data } = await admin
    .schema("events")
    .from("events")
    .select(eventColumns)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("members_only", false)
    .maybeSingle();
  return data ? toIcs(data, locale) : null;
};

/**
 * A member's private feed: their RSVPs, all public SAL events, members-only
 * events (members only) and the AUIB campus calendar. Found by the secret
 * token in the URL; reset by the member from the Nexus.
 */
export const memberFeed = async (admin: AdminClient, token: string) => {
  const { data: owner } = await admin
    .schema("membership")
    .from("calendar_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();
  if (!owner) {
    return null;
  }

  const [{ data: profile }, { data: isMember }, { data: rsvps }] =
    await Promise.all([
      admin
        .schema("core")
        .from("profiles")
        .select("locale")
        .eq("id", owner.user_id)
        .maybeSingle(),
      admin.schema("membership").rpc("is_member", { uid: owner.user_id }),
      admin
        .schema("events")
        .from("rsvps")
        .select("event_id")
        .eq("user_id", owner.user_id)
        .eq("status", "confirmed"),
    ]);
  const locale = profile?.locale === "ar" ? "ar" : "en";
  const going = new Set((rsvps ?? []).map((r) => r.event_id));

  let query = admin
    .schema("events")
    .from("events")
    .select(eventColumns)
    .eq("status", "published")
    .gte("starts_at", since())
    .order("starts_at");
  if (!isMember) {
    query = query.eq("members_only", false);
  }
  const [{ data: events }, { data: campus }] = await Promise.all([
    query,
    admin
      .schema("events")
      .from("campus_events")
      .select("*")
      .gte("starts_at", since())
      .order("starts_at"),
  ]);

  return {
    events: [
      ...(events ?? []).map((event) =>
        toIcs(event, locale, going.has(event.id) ? "[RSVP]" : undefined)
      ),
      ...(campus ?? []).map(
        (event): IcsEvent => ({
          description: event.description,
          end: event.ends_at,
          location: event.location,
          start: event.starts_at,
          tag: "[AUIB]",
          title: event.title,
          uid: `auib-${event.uid}@${project.domain}`,
          url: event.url,
        })
      ),
    ],
    locale,
  };
};

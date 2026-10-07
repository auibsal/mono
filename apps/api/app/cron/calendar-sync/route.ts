import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { env } from "@/env";
import { hasBearer } from "@/lib/bearer";
import { parseIcal } from "@/lib/ical";

export const maxDuration = 60;

/**
 * Hourly (pg_cron, or Vercel Cron with CRON_SECRET): reads the AUIB public
 * calendar (`auib.calendar_url`) into core.external_events. Unset or ""
 * means there is nothing to sync. Events that left the feed are removed
 * from the window the feed covers.
 */
const sync = async (request: Request) => {
  if (!hasBearer(request, env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: setting } = await admin
    .schema("core")
    .from("settings")
    .select("value")
    .eq("key", "auib.calendar_url")
    .maybeSingle();
  const url = typeof setting?.value === "string" ? setting.value.trim() : "";
  if (!url) {
    return Response.json({ skipped: "no calendar URL" });
  }

  let text: string;
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/calendar",
        "user-agent": "auibsal.org calendar sync (+https://auibsal.org)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    text = await response.text();
  } catch (error) {
    log.error(`AUIB calendar fetch failed: ${parseError(error)}`);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const events = parseIcal(text);
  if (events.length === 0) {
    return Response.json({ synced: 0 });
  }
  const syncedAt = new Date().toISOString();
  const { error: storeError } = await admin
    .schema("core")
    .from("external_events")
    .upsert(
      events.map((e) => ({
        all_day: e.allDay,
        ends_at: e.end,
        location: e.location,
        source: "auib",
        starts_at: e.start,
        synced_at: syncedAt,
        title: e.title,
        uid: e.uid,
        url: e.url,
      })),
      { onConflict: "source,uid" }
    );
  if (storeError) {
    log.error(`AUIB calendar upsert failed: ${storeError.message}`);
    return Response.json({ error: "store_failed" }, { status: 500 });
  }
  const earliest = events.reduce(
    (min, e) => (e.start < min ? e.start : min),
    events[0].start
  );
  await admin
    .schema("core")
    .from("external_events")
    .delete()
    .eq("source", "auib")
    .lt("synced_at", syncedAt)
    .gte("starts_at", earliest);
  return Response.json({ synced: events.length });
};

export const GET = sync;
export const POST = sync;

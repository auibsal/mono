import { openCalls, upcomingCalls } from "@repo/sal-data/journal";
import { json, open, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/** GET /v1/journal/calls: calls open now and announced ones (public). */
export const GET = open(async (supabase) => {
  const [current, upcoming] = await Promise.all([
    openCalls(supabase),
    upcomingCalls(supabase),
  ]);
  return json({ open: current, upcoming });
});

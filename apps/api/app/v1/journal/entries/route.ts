import { unwrap } from "@repo/sal-data/client";
import { z } from "zod";
import { json, member, preflight, problem } from "@/lib/v1";

export const OPTIONS = preflight;

/**
 * GET /v1/journal/entries?issue={id}: the blind entries of an issue the
 * member may see (editors: all of them; the Advisory Board: flagged ones;
 * readers: their own), with reads and scores. Never the author's identity.
 */
export const GET = member(async ({ supabase }, request) => {
  const issue = new URL(request.url).searchParams.get("issue") ?? "";
  if (!z.uuid().safeParse(issue).success) {
    return problem(400, "issue_required");
  }
  const entries = unwrap(
    await supabase
      .schema("journal")
      .from("blind_entries")
      .select(
        "id, blind_id, category, language, title, status, flagged, flag_note, editor_notes, created_at, assignments(id, read_number, score:scores(total, craft, voice, depth, archive_factor, comment)), decision:decisions(decision, notes, decided_at)"
      )
      .eq("issue_id", issue)
      .order("created_at")
  );
  return json({ entries });
});

import { unwrap } from "@repo/sal-data/client";
import { json, member, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/**
 * GET /v1/journal/reviews: the blind entries assigned to the member as a
 * reader, with their scores so far. Entries carry a blind id, never the
 * author: the database does not give a reader anything else.
 */
export const GET = member(async ({ supabase, userId }) => {
  const reviews = unwrap(
    await supabase
      .schema("journal")
      .from("assignments")
      .select(
        "id, read_number, assigned_at, entry:blind_entries!inner(id, blind_id, issue_id, category, language, title, body_html, source_text, status), score:scores(craft, voice, depth, archive_factor, total, comment, submitted_at)"
      )
      .eq("reader_id", userId)
      .order("assigned_at")
  );
  return json({ reviews });
});

import { unwrap } from "@repo/sal-data/client";
import { z } from "zod";
import { body, json, member, preflight, problem } from "@/lib/v1";

export const OPTIONS = preflight;

const schema = z.object({
  decision: z.enum(["accept", "accept_with_edits", "decline"]),
  notes: z.string().max(4000).optional(),
});

/**
 * POST /v1/journal/entries/{id}/decision: record the editorial decision on
 * a blind entry. Needs journal.decide (and two-step sign-in); the author is
 * told by email and on their devices.
 */
export const POST = member<{ id: string }>(
  async ({ supabase }, request, { id }) => {
    if (!z.uuid().safeParse(id).success) {
      return problem(404, "not_found");
    }
    const parsed = await body(request, schema);
    if ("response" in parsed) {
      return parsed.response;
    }
    unwrap(
      await supabase.schema("journal").rpc("decide", {
        blind_entry_id: id,
        decision: parsed.data.decision,
        notes: parsed.data.notes,
      })
    );
    return json({ ok: true });
  }
);

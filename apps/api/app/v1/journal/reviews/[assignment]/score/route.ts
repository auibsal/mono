import { scoreSchema, submitScore } from "@repo/sal-data/journal";
import { z } from "zod";
import { body, json, member, preflight, problem } from "@/lib/v1";

export const OPTIONS = preflight;

/**
 * POST /v1/journal/reviews/{assignment}/score: score an assigned entry on
 * the rubric (craft, voice, depth, archive_factor: 1 to 5, and a comment).
 * Sending it again replaces the score.
 */
export const POST = member<{ assignment: string }>(
  async ({ supabase }, request, { assignment }) => {
    if (!z.uuid().safeParse(assignment).success) {
      return problem(404, "not_found");
    }
    const parsed = await body(request, scoreSchema);
    if ("response" in parsed) {
      return parsed.response;
    }
    return json(await submitScore(supabase, assignment, parsed.data));
  }
);

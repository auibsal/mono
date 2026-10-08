import { submissionStatuses, transition } from "@repo/sal-data/journal";
import { z } from "zod";
import { body, json, member, preflight, problem } from "@/lib/v1";

export const OPTIONS = preflight;

const schema = z.object({
  note: z.string().max(2000).optional(),
  to: z.enum(submissionStatuses),
});

/**
 * POST /v1/journal/submissions/{id}/transition: move a submission along
 * the pipeline (intake, withdrawal). The database checks who may make
 * which move.
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
    await transition(supabase, id, parsed.data.to, parsed.data.note);
    return json({ ok: true });
  }
);

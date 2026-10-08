import {
  createSubmission,
  mySubmissions,
  submissionSchema,
} from "@repo/sal-data/journal";
import { body, json, member, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/** GET /v1/journal/submissions: the member's own submissions. */
export const GET = member(async ({ supabase }) =>
  json({ submissions: await mySubmissions(supabase) })
);

/**
 * POST /v1/journal/submissions: submit a piece to an open call, as text.
 * The Human Authorship pledge is reconfirmed on every submission; the
 * database enforces the call window and the limit per member.
 */
export const POST = member(async ({ supabase }, request) => {
  const parsed = await body(request, submissionSchema);
  if ("response" in parsed) {
    return parsed.response;
  }
  return json(await createSubmission(supabase, parsed.data), 201);
});

import { publishedIssues } from "@repo/sal-data/journal";
import { json, open, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/** GET /v1/journal/issues: the published issues (public). */
export const GET = open(async (supabase) =>
  json({ issues: await publishedIssues(supabase) })
);

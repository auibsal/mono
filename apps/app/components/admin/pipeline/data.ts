"use client";

import { useAuth } from "@repo/auth/provider";
import { journal, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { callApi } from "@/lib/api";

export type SubmissionStatus = journal.SubmissionStatus;
export type Category = journal.Category;

export const pipelineKey = ["admin", "pipeline"];

/** Issues the member has a part in, with what they may do in each. */
export const usePipelineIssues = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      unwrap(await supabase.schema("journal").rpc("pipeline_issues")) ?? [],
    queryKey: [...pipelineKey, "issues"],
  });
};

export type PipelineIssue = NonNullable<
  ReturnType<typeof usePipelineIssues>["data"]
>[number];

/** Blind entries for an issue with their reads (editors see every score). */
export const useBlindEntries = (issueId: string, enabled = true) => {
  const { supabase } = useAuth();
  return useQuery({
    enabled: enabled && Boolean(issueId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("blind_entries")
          .select(
            "id, blind_id, title, category, language, status, flagged, flag_note, updated_at, assignments(id, reader_id, read_number, score:scores(total))"
          )
          .eq("issue_id", issueId)
          .order("created_at")
      ) ?? [],
    queryKey: [...pipelineKey, "entries", issueId],
  });
};

export type BlindEntryRow = NonNullable<
  ReturnType<typeof useBlindEntries>["data"]
>[number];

/** Read totals in read order (1, 2, then the third read). */
export const readTotals = (entry: Pick<BlindEntryRow, "assignments">) =>
  [...entry.assignments]
    .sort((a, b) => a.read_number - b.read_number)
    .map((a) => a.score?.total ?? null);

export const entryAverage = (entry: Pick<BlindEntryRow, "assignments">) =>
  journal.averageTotal(readTotals(entry));

export interface BlindFile {
  kind: string;
  mimeType: string;
  name: string;
  url: string | null;
}

/** Links to the metadata-stripped copies (apps/api checks access by RLS). */
export const useBlindFiles = () => {
  const { supabase } = useAuth();
  return (entry: string) =>
    callApi<{ files: BlindFile[] }>(supabase, "/files/blind", { entry });
};

export const openSubmissionFile = async (
  supabase: ReturnType<typeof useAuth>["supabase"],
  id: string
) => {
  const { url } = await callApi<{ url: string }>(
    supabase,
    "/files/submission",
    { id }
  );
  window.open(url, "_blank", "noopener,noreferrer");
};

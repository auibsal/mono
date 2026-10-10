import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@repo/database/admin";
import { bareId, type Notion, NotionError } from "./client";

export type Admin = ReturnType<typeof createAdminClient>;

export type LinkKind =
  | "document"
  | "event"
  | "journal_stage"
  | "minutes"
  | "news"
  | "officer"
  | "programme";

/** The workspace's data sources (core.settings `notion.data_sources`). */
export interface Sources {
  documents: string;
  events: string;
  journal: string;
  news: string;
  officers: string;
  programmes: string;
}

export interface SyncContext {
  admin: Admin;
  appUrl: string;
  counts: Record<string, number>;
  /** Stop starting new work after this moment (the function has 60 s). */
  deadline: number;
  notion: Notion;
  problems: string[];
  sources: Sources;
  webUrl: string;
}

export const hashOf = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const count = (ctx: SyncContext, key: string, by = 1) => {
  ctx.counts[key] = (ctx.counts[key] ?? 0) + by;
};

export const outOfTime = (ctx: SyncContext) => Date.now() > ctx.deadline;

export interface Link {
  content_hash: string | null;
  notion_page_id: string;
  record_key: string;
}

export const linksOf = async (ctx: SyncContext, kind: LinkKind) => {
  const { data, error } = await ctx.admin
    .schema("core")
    .from("notion_links")
    .select("notion_page_id, record_key, content_hash")
    .eq("kind", kind);
  if (error) {
    throw error;
  }
  return new Map((data ?? []).map((l: Link) => [l.record_key, l]));
};

/** The Nexus record a Notion page stands for, if any. */
export const recordFor = async (
  ctx: SyncContext,
  kind: LinkKind,
  pageId: string
) => {
  const { data } = await ctx.admin
    .schema("core")
    .from("notion_links")
    .select("record_key")
    .eq("kind", kind)
    .eq("notion_page_id", bareId(pageId))
    .maybeSingle();
  return data?.record_key ?? null;
};

export const saveLink = async (
  ctx: SyncContext,
  kind: LinkKind,
  pageId: string,
  recordKey: string,
  contentHash: string | null
) => {
  // One page per record: drop any older page for this record first.
  await ctx.admin
    .schema("core")
    .from("notion_links")
    .delete()
    .eq("kind", kind)
    .eq("record_key", recordKey)
    .neq("notion_page_id", bareId(pageId));
  const { error } = await ctx.admin
    .schema("core")
    .from("notion_links")
    .upsert({
      content_hash: contentHash,
      kind,
      notion_page_id: bareId(pageId),
      record_key: recordKey,
      synced_at: new Date().toISOString(),
    });
  if (error) {
    throw error;
  }
};

export const dropLink = (ctx: SyncContext, pageId: string) =>
  ctx.admin
    .schema("core")
    .from("notion_links")
    .delete()
    .eq("notion_page_id", bareId(pageId));

const TRASHED = /archiv|trash/i;

/** The page is gone from Notion (deleted, in the trash, or not shared). */
export const isGone = (error: unknown) =>
  error instanceof NotionError &&
  (error.status === 404 ||
    (error.status === 400 && TRASHED.test(error.message)));

export const problem = (ctx: SyncContext, text: string) => {
  ctx.problems.push(text.slice(0, 300));
};

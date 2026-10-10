import "server-only";

import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { env } from "@/env";
import { createNotion, type Notion, type NotionUser } from "./client";
import type { Admin, Sources, SyncContext } from "./context";
import {
  mirrorDocuments,
  mirrorJournal,
  mirrorOfficers,
  mirrorProgrammes,
  peopleByEmail,
} from "./mirrors";
import { adoptNexusItems, publishWaiting, syncRsvpCounts } from "./publish";

const TRAILING_SLASH = /\/$/;
const SOURCE_KEYS = [
  "documents",
  "events",
  "journal",
  "news",
  "officers",
  "programmes",
] as const;

const setting = async (admin: Admin, key: string) => {
  const { data } = await admin
    .schema("core")
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
};

const sourcesFrom = (value: unknown): Sources | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const v = value as Record<string, unknown>;
  return SOURCE_KEYS.every((k) => typeof v[k] === "string")
    ? (v as unknown as Sources)
    : null;
};

export interface SyncState {
  at: string;
  counts: Record<string, number>;
  ms: number;
  problems: string[];
}

/** Everything one sync does, in order: mirrors first, then publishing. */
const steps: [
  string,
  (ctx: SyncContext, users: NotionUser[]) => Promise<void>,
][] = [
  ["programs", (ctx) => mirrorProgrammes(ctx)],
  ["officers", (ctx, users) => mirrorOfficers(ctx, peopleByEmail(users))],
  ["documents", (ctx) => mirrorDocuments(ctx)],
  ["journal", (ctx) => mirrorJournal(ctx)],
  ["publishing", (ctx) => publishWaiting(ctx)],
  ["nexus items", (ctx) => adoptNexusItems(ctx)],
  ["rsvps", (ctx) => syncRsvpCounts(ctx)],
];

export const runNotionSync = async (
  notion: Notion | null = env.NOTION_TOKEN
    ? createNotion(env.NOTION_TOKEN)
    : null
): Promise<SyncState | { skipped: string }> => {
  if (!notion) {
    return { skipped: "NOTION_TOKEN is not set" };
  }
  const admin = createAdminClient();
  const sources = sourcesFrom(await setting(admin, "notion.data_sources"));
  if (!sources) {
    return { skipped: "notion.data_sources is not set" };
  }
  const started = Date.now();
  const ctx: SyncContext = {
    admin,
    appUrl: env.NEXT_PUBLIC_APP_URL.replace(TRAILING_SLASH, ""),
    counts: {},
    deadline: started + 45_000,
    notion,
    problems: [],
    sources,
    webUrl: env.NEXT_PUBLIC_WEB_URL.replace(TRAILING_SLASH, ""),
  };

  let users: NotionUser[] = [];
  try {
    users = await notion.users();
  } catch (error) {
    ctx.problems.push(`users: ${parseError(error)}`);
  }
  // Each step stands alone: one failing (a renamed property, a page not
  // shared with the connection) does not stop the rest.
  for (const [name, step] of steps) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: steps share Notion's rate limit
      await step(ctx, users);
    } catch (error) {
      ctx.problems.push(`${name}: ${parseError(error)}`);
    }
  }

  const state: SyncState = {
    at: new Date().toISOString(),
    counts: ctx.counts,
    ms: Date.now() - started,
    problems: ctx.problems.slice(0, 20),
  };
  await admin
    .schema("core")
    .from("settings")
    .update({ value: state as never })
    .eq("key", "notion.sync_state");
  if (ctx.problems.length > 0) {
    log.warn(`Notion sync: ${ctx.problems.length} problem(s)`, {
      first: ctx.problems[0] ?? "",
    });
  }
  return state;
};

export interface AccessLists {
  /** Officers in the Nexus with no Notion account under their address. */
  invite: { email: string; name: string; roles: string[] }[];
  /** Notion members who hold no role in the Nexus. */
  remove: { email: string; name: string }[];
}

/**
 * Who should be in the workspace (everyone holding a role in the Nexus)
 * against who is. Notion's API cannot invite or remove people, so these
 * are lists for a workspace owner to act on.
 */
export const accessLists = async (notion: Notion): Promise<AccessLists> => {
  const admin = createAdminClient();
  const [{ data: officers, error }, users] = await Promise.all([
    admin.schema("access").rpc("officer_directory"),
    notion.users(),
  ]);
  if (error) {
    throw error;
  }
  const people = users.filter((u) => u.type === "person" && u.person?.email);
  const inNotion = new Set(
    people.map((u) => (u.person?.email ?? "").toLowerCase())
  );
  const officerEmails = new Set(
    (officers ?? []).map((o) => (o.email ?? "").toLowerCase())
  );
  return {
    invite: (officers ?? [])
      .filter((o) => o.email && !inNotion.has(o.email.toLowerCase()))
      .map((o) => ({
        email: o.email ?? "",
        name: o.full_name_en?.trim() || (o.email ?? ""),
        roles: o.roles ?? [],
      })),
    remove: people
      .filter((u) => !officerEmails.has((u.person?.email ?? "").toLowerCase()))
      .map((u) => ({ email: u.person?.email ?? "", name: u.name ?? "" })),
  };
};

export const readSyncState = async () =>
  (await setting(createAdminClient(), "notion.sync_state")) as SyncState | null;

export const homeUrl = async () => {
  const value = await setting(createAdminClient(), "notion.home_url");
  return typeof value === "string" ? value : null;
};

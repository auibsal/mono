import "server-only";

import type { NotionUser } from "./client";
import {
  count,
  dropLink,
  hashOf,
  isGone,
  type Link,
  type LinkKind,
  linksOf,
  outOfTime,
  problem,
  type SyncContext,
  saveLink,
} from "./context";
import { prop } from "./props";

/**
 * Read-only copies in Notion ("From the Nexus"). Each row is written only
 * when it changed (by hash) and removed from Notion when its record is
 * gone. Nothing here is read back: the Nexus stays the source.
 */
interface Row {
  key: string;
  props: Record<string, object>;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Writes one row: updates its page, or creates one (again, if deleted). */
const writeRow = async (
  ctx: SyncContext,
  kind: LinkKind,
  dataSourceId: string,
  row: Row,
  link: Link | undefined
) => {
  const contentHash = hashOf(row.props);
  if (link?.content_hash === contentHash) {
    return;
  }
  const props = { ...row.props, Synced: prop.date(today()) };
  if (link) {
    try {
      await ctx.notion.updatePage(link.notion_page_id, props);
      await saveLink(ctx, kind, link.notion_page_id, row.key, contentHash);
      count(ctx, `${kind}.updated`);
      return;
    } catch (error) {
      if (!isGone(error)) {
        throw error;
      }
      // Someone deleted the copy in Notion: write it again.
    }
  }
  const page = await ctx.notion.createPage(dataSourceId, props);
  await saveLink(ctx, kind, page.id, row.key, contentHash);
  count(ctx, `${kind}.created`);
};

/** Removes the copy of a record that no longer exists in the Nexus. */
const removeRow = async (
  ctx: SyncContext,
  kind: LinkKind,
  key: string,
  link: Link
) => {
  try {
    await ctx.notion.trashPage(link.notion_page_id);
  } catch (error) {
    if (!isGone(error)) {
      problem(ctx, `${kind} ${key}: ${(error as Error).message}`);
      return;
    }
  }
  await dropLink(ctx, link.notion_page_id);
  count(ctx, `${kind}.removed`);
};

const mirror = async (
  ctx: SyncContext,
  kind: LinkKind,
  dataSourceId: string,
  rows: Row[]
) => {
  const links = await linksOf(ctx, kind);
  const keep = new Set(rows.map((r) => r.key));

  // One at a time: Notion allows about three requests a second.
  for (const row of rows) {
    if (outOfTime(ctx)) {
      return;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
      await writeRow(ctx, kind, dataSourceId, row, links.get(row.key));
    } catch (error) {
      problem(ctx, `${kind} ${row.key}: ${(error as Error).message}`);
    }
  }
  for (const [key, link] of links) {
    if (keep.has(key) || outOfTime(ctx)) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
    await removeRow(ctx, kind, key, link);
  }
};

const app = (ctx: SyncContext, path: string) => `${ctx.appUrl}/en${path}`;

export const mirrorProgrammes = async (ctx: SyncContext) => {
  const { data, error } = await ctx.admin
    .schema("core")
    .from("programmes")
    .select("id, kind, name_en, name_ar, summary_en, is_active, sort")
    .order("sort");
  if (error) {
    throw error;
  }
  await mirror(
    ctx,
    "programme",
    ctx.sources.programmes,
    (data ?? []).map((p) => ({
      key: p.id,
      props: {
        Active: prop.checkbox(p.is_active),
        Kind: prop.select(p.kind === "format" ? "format" : "flagship"),
        Name: prop.title(p.name_en),
        "Name (Arabic)": prop.text(p.name_ar),
        Nexus: prop.url(app(ctx, "/admin/programs")),
        "Nexus ID": prop.text(p.id),
        Summary: prop.text(p.summary_en),
      },
    }))
  );
};

/** Notion members by AUIB address, to fill the People column. */
export const peopleByEmail = (users: NotionUser[]) =>
  new Map(
    users
      .filter((u) => u.type === "person" && u.person?.email)
      .map((u) => [(u.person?.email ?? "").toLowerCase(), u.id])
  );

const day = (value: string | null) => (value ? value.slice(0, 10) : null);

export const mirrorOfficers = async (
  ctx: SyncContext,
  people: ReadonlyMap<string, string>
) => {
  const { data, error } = await ctx.admin
    .schema("access")
    .rpc("officer_directory");
  if (error) {
    throw error;
  }
  await mirror(
    ctx,
    "officer",
    ctx.sources.officers,
    (data ?? []).map((o) => {
      const person = people.get((o.email ?? "").toLowerCase());
      return {
        key: o.user_id,
        props: {
          "AUIB email": prop.email(o.email),
          Council: prop.checkbox(o.council === true),
          Name: prop.title(o.full_name_en?.trim() || o.email || ""),
          "Name (Arabic)": prop.text(o.full_name_ar),
          Nexus: prop.url(app(ctx, `/admin/members/member?id=${o.user_id}`)),
          "Nexus ID": prop.text(o.user_id),
          "Notion person": prop.people(person ? [person] : []),
          Roles: prop.multi(o.roles ?? []),
          "Term ends": prop.date(day(o.term_ends)),
          "Term starts": prop.date(day(o.term_starts)),
        },
      };
    })
  );
};

export const mirrorDocuments = async (ctx: SyncContext) => {
  const [documents, minutes] = await Promise.all([
    ctx.admin
      .schema("governance")
      .from("society_documents")
      .select("id, slug, code, title_en, audience, status, dated, adopted_on")
      .order("sort"),
    ctx.admin
      .schema("governance")
      .from("minutes")
      .select("id, body, meeting_on, title_en, status, adopted_on")
      .order("meeting_on", { ascending: false }),
  ]);
  if (documents.error) {
    throw documents.error;
  }
  if (minutes.error) {
    throw minutes.error;
  }
  await mirror(
    ctx,
    "document",
    ctx.sources.documents,
    (documents.data ?? []).map((d) => ({
      key: d.id,
      props: {
        "Adopted on": prop.date(d.adopted_on),
        Audience: prop.select(d.audience),
        Code: prop.text(d.code),
        Dated: prop.date(d.dated),
        Kind: prop.select("Document"),
        Nexus: prop.url(app(ctx, "/admin/documents")),
        "Nexus ID": prop.text(d.id),
        "Public page": prop.url(
          d.audience === "public"
            ? `${ctx.webUrl}/en/documents/${d.slug}`
            : null
        ),
        Status: prop.select(d.status),
        Title: prop.title(d.title_en),
      },
    }))
  );
  await mirror(
    ctx,
    "minutes",
    ctx.sources.documents,
    (minutes.data ?? []).map((m) => ({
      key: m.id,
      props: {
        "Adopted on": prop.date(m.adopted_on),
        Audience: prop.select("internal"),
        Code: prop.text(m.body === "council" ? "Council" : "General Assembly"),
        Dated: prop.date(m.meeting_on),
        Kind: prop.select("Minutes"),
        Nexus: prop.url(app(ctx, `/admin/governance/minutes?id=${m.id}`)),
        "Nexus ID": prop.text(m.id),
        "Public page": prop.url(null),
        Status: prop.select(m.status),
        Title: prop.title(m.title_en),
      },
    }))
  );
};

/** Stage names in the order a submission moves through them. */
export const STAGES = [
  ["received", "Received"],
  ["intake_check", "Intake check"],
  ["in_review", "In review"],
  ["third_read", "Third read"],
  ["selection", "Selection"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
  ["withdrawn", "Withdrawn"],
] as const;

/**
 * Counts per stage for calls that are open or closed in the last 90 days.
 * Only numbers leave the Nexus: no titles, no authors (review is blind).
 */
export const mirrorJournal = async (ctx: SyncContext) => {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: calls, error } = await ctx.admin
    .schema("journal")
    .from("calls")
    .select("id, title_en, closes_at")
    .gte("closes_at", since);
  if (error) {
    throw error;
  }
  const rows: Row[] = [];
  for (const call of calls ?? []) {
    // biome-ignore lint/performance/noAwaitInLoops: a few calls at most
    const { data: subs } = await ctx.admin
      .schema("journal")
      .from("submissions")
      .select("status")
      .eq("call_id", call.id);
    const tally = new Map<string, number>();
    for (const s of subs ?? []) {
      tally.set(s.status, (tally.get(s.status) ?? 0) + 1);
    }
    STAGES.forEach(([stage, label], index) => {
      rows.push({
        key: `${call.id}:${stage}`,
        props: {
          Call: prop.text(call.title_en),
          Closes: prop.date(day(call.closes_at)),
          Count: prop.number(tally.get(stage) ?? 0),
          Nexus: prop.url(app(ctx, "/admin/pipeline")),
          "Nexus ID": prop.text(`${call.id}:${stage}`),
          Order: prop.number(index + 1),
          Stage: prop.title(label),
        },
      });
    });
  }
  await mirror(ctx, "journal_stage", ctx.sources.journal, rows);
};

import "server-only";

import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { sanitizeRichText } from "@repo/sal-data";
import { uploadMedia } from "@repo/storage";
import { pageBodies } from "./blocks";
import { bareId, type NotionPage } from "./client";
import {
  count,
  linksOf,
  outOfTime,
  problem,
  recordFor,
  type SyncContext,
  saveLink,
} from "./context";
import { prop, read } from "./props";
import { checkEvent, checkNews } from "./rules";

/**
 * Events and news are written in Notion (Publishing). A page set to
 * "Ready to publish" is checked and published; "Cancel on the site" cancels
 * a published event. The person who last edited the page must hold the
 * permission in the Nexus (events.manage, content.manage), matched by email.
 * Results go back to the page: status, links, and a note saying what was
 * done or what to fix (also left as a comment).
 */

const READY = "Ready to publish";
const CANCEL = "Cancel on the site";

type Kind = "event" | "news";

const PERMISSION: Record<Kind, "content.manage" | "events.manage"> = {
  event: "events.manage",
  news: "content.manage",
};

const stamp = () => {
  const now = new Date().toISOString();
  return `${formatLongDate(now, "en")}, ${formatClock(now, "en")}`;
};

const needsChanges = async (
  ctx: SyncContext,
  page: NotionPage,
  problems: string[]
) => {
  const note = `Not published (${stamp()}): ${problems.join(" ")}`;
  await ctx.notion.updatePage(page.id, {
    "Platform note": prop.text(note),
    Status: prop.select("Needs changes"),
  });
  await ctx.notion.comment(page.id, note);
  count(ctx, "publish.refused");
};

/** The email of the person who last edited the page, if Notion shares it. */
const editorEmail = async (ctx: SyncContext, page: NotionPage) => {
  const id = page.last_edited_by?.id;
  if (!id) {
    return null;
  }
  const user = await ctx.notion.user(id).catch(() => null);
  return user?.type === "person" ? (user.person?.email ?? null) : null;
};

const NO_EMAIL =
  "The platform could not see who set the status. In Notion, open Settings, Connections, SAL Platform, and allow it to read user information including email addresses.";

const publisherFor = async (
  ctx: SyncContext,
  kind: Kind,
  email: string,
  programmeId: string | null
) => {
  const { data } = await ctx.admin.schema("access").rpc("notion_publisher", {
    email,
    permission: PERMISSION[kind],
    scope_id: programmeId ?? undefined,
    scope_type: programmeId ? "programme" : "global",
  });
  return (data as string | null) ?? null;
};

const publisherName = async (ctx: SyncContext, userId: string) => {
  const { data } = await ctx.admin
    .schema("core")
    .from("profiles")
    .select("full_name_en")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name_en?.trim() || "an officer";
};

/** The page's first image, copied to the public media bucket. */
const copyImage = async (
  ctx: SyncContext,
  page: NotionPage,
  property: string,
  area: string
) => {
  const [file] = read.files(page, property);
  if (!file) {
    return;
  }
  const response = await fetch(file.url, {
    signal: AbortSignal.timeout(20_000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!(response.ok && type.startsWith("image/"))) {
    problem(ctx, `Could not copy the image on ${page.id}.`);
    return;
  }
  const bytes = await response.arrayBuffer();
  const stored = await uploadMedia(
    ctx.admin,
    area,
    new File([bytes], file.name || "image", { type })
  );
  return stored.path;
};

const programmeMap = async (ctx: SyncContext) =>
  new Map(
    [...(await linksOf(ctx, "programme")).entries()].map(([key, l]) => [
      l.notion_page_id,
      key,
    ])
  );

const slugTaken = async (
  ctx: SyncContext,
  table: "events" | "news_posts",
  slug: string,
  ownId: string | null
) => {
  const query =
    table === "events"
      ? ctx.admin.schema("events").from("events").select("id").eq("slug", slug)
      : ctx.admin
          .schema("content")
          .from("news_posts")
          .select("id")
          .eq("slug", slug);
  const { data } = await (ownId ? query.neq("id", ownId) : query).limit(1);
  return (data ?? []).length > 0;
};

const bodiesOf = async (ctx: SyncContext, page: NotionPage) => {
  const bodies = pageBodies(await ctx.notion.blocks(page.id));
  // An empty page keeps the text already in the Nexus (rows that started
  // there, before anyone wrote them in Notion).
  return {
    ...(bodies.en ? { body_en: sanitizeRichText(bodies.en) } : {}),
    ...(bodies.ar ? { body_ar: sanitizeRichText(bodies.ar) } : {}),
  };
};

const publishedNote = (who: string) => `Published ${stamp()} by ${who}.`;

const cancelEvent = async (
  ctx: SyncContext,
  page: NotionPage,
  email: string
) => {
  const id = await recordFor(ctx, "event", page.id);
  if (!id) {
    await needsChanges(ctx, page, [
      "This event was never published, so there is nothing to cancel. Set Status to Canceled.",
    ]);
    return;
  }
  const publisher = await publisherFor(ctx, "event", email, null);
  if (!publisher) {
    await needsChanges(ctx, page, [
      `${email} does not hold events.manage in the Nexus, so the event stays as it is.`,
    ]);
    return;
  }
  const { error } = await ctx.admin
    .schema("events")
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) {
    throw error;
  }
  await ctx.notion.updatePage(page.id, {
    "Platform note": prop.text(
      `Canceled on the site ${stamp()} by ${await publisherName(ctx, publisher)}. Members who booked are not told automatically: post an announcement in the Nexus (Administration, Content).`
    ),
    Status: prop.select("Canceled"),
  });
  count(ctx, "event.canceled");
};

const publishEvent = async (
  ctx: SyncContext,
  page: NotionPage,
  email: string,
  programmes: ReadonlyMap<string, string>
) => {
  const checked = checkEvent(page, programmes);
  if (!checked.ok) {
    await needsChanges(ctx, page, checked.problems);
    return;
  }
  const v = checked.values;
  const publisher = await publisherFor(ctx, "event", email, v.programme_id);
  if (!publisher) {
    await needsChanges(ctx, page, [
      `${email} does not hold events.manage in the Nexus${v.programme_id ? " for this program" : ""}. Ask someone who does to set Ready to publish.`,
    ]);
    return;
  }
  const existing = await recordFor(ctx, "event", page.id);
  if (await slugTaken(ctx, "events", v.slug, existing)) {
    await needsChanges(ctx, page, [
      `Another event already uses the Slug ${v.slug}. Set a different Slug.`,
    ]);
    return;
  }
  const image = await copyImage(ctx, page, "Image", "events");
  const row = {
    ...v,
    ...(await bodiesOf(ctx, page)),
    ...(image ? { image_path: image } : {}),
    status: "published",
  };
  let id = existing;
  if (id) {
    const { error } = await ctx.admin
      .schema("events")
      .from("events")
      .update(row)
      .eq("id", id);
    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await ctx.admin
      .schema("events")
      .from("events")
      .insert({
        ...row,
        created_by: publisher,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      throw error;
    }
    ({ id } = data);
  }
  await saveLink(ctx, "event", page.id, id, null);
  await ctx.notion.updatePage(page.id, {
    Nexus: prop.url(`${ctx.appUrl}/en/admin/events/edit?id=${id}`),
    "Nexus ID": prop.text(id),
    "Platform note": prop.text(
      publishedNote(await publisherName(ctx, publisher))
    ),
    "Public page": prop.url(`${ctx.webUrl}/en/events/${v.slug}`),
    Slug: prop.text(v.slug),
    Status: prop.select("Published"),
  });
  count(ctx, existing ? "event.republished" : "event.published");
};

const publishNews = async (
  ctx: SyncContext,
  page: NotionPage,
  email: string,
  programmes: ReadonlyMap<string, string>
) => {
  const checked = checkNews(page, programmes);
  if (!checked.ok) {
    await needsChanges(ctx, page, checked.problems);
    return;
  }
  const v = checked.values;
  const publisher = await publisherFor(ctx, "news", email, v.programme_id);
  if (!publisher) {
    await needsChanges(ctx, page, [
      `${email} does not hold content.manage in the Nexus. Ask someone who does to set Ready to publish.`,
    ]);
    return;
  }
  const existing = await recordFor(ctx, "news", page.id);
  if (await slugTaken(ctx, "news_posts", v.slug, existing)) {
    await needsChanges(ctx, page, [
      `Another news post already uses the Slug ${v.slug}. Set a different Slug.`,
    ]);
    return;
  }
  const later =
    v.publish_at !== null && v.publish_at > new Date().toISOString();
  const cover = await copyImage(ctx, page, "Cover", "news");
  const row = {
    ...v,
    ...(await bodiesOf(ctx, page)),
    ...(cover ? { cover_path: cover } : {}),
    status: later ? "scheduled" : "published",
  };
  let id = existing;
  if (id) {
    const { error } = await ctx.admin
      .schema("content")
      .from("news_posts")
      .update(row)
      .eq("id", id);
    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await ctx.admin
      .schema("content")
      .from("news_posts")
      .insert({
        ...row,
        author_id: publisher,
        published_at: later ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      throw error;
    }
    ({ id } = data);
  }
  await saveLink(ctx, "news", page.id, id, null);
  const who = await publisherName(ctx, publisher);
  await ctx.notion.updatePage(page.id, {
    Nexus: prop.url(`${ctx.appUrl}/en/admin/content/news?id=${id}`),
    "Nexus ID": prop.text(id),
    "Platform note": prop.text(
      later && v.publish_at
        ? `Scheduled ${stamp()} by ${who}; goes live ${formatLongDate(v.publish_at, "en")}, ${formatClock(v.publish_at, "en")}.`
        : publishedNote(who)
    ),
    "Public page": prop.url(`${ctx.webUrl}/en/news/${v.slug}`),
    Slug: prop.text(v.slug),
    Status: prop.select("Published"),
  });
  count(ctx, existing ? "news.republished" : "news.published");
};

const statusFilter = (statuses: string[]) => ({
  or: statuses.map((s) => ({ property: "Status", select: { equals: s } })),
});

/** Pages waiting for the platform, handled one at a time. */
export const publishWaiting = async (ctx: SyncContext) => {
  const programmes = await programmeMap(ctx);
  const [events, news] = await Promise.all([
    ctx.notion.query(ctx.sources.events, statusFilter([READY, CANCEL])),
    ctx.notion.query(ctx.sources.news, {
      and: [
        { property: "Kind", select: { equals: "News post" } },
        statusFilter([READY]),
      ],
    }),
  ]);
  const queue: [Kind, NotionPage][] = [
    ...events.map((p): [Kind, NotionPage] => ["event", p]),
    ...news.map((p): [Kind, NotionPage] => ["news", p]),
  ];
  for (const [kind, page] of queue) {
    if (outOfTime(ctx)) {
      return;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
      const email = await editorEmail(ctx, page);
      if (!email) {
        await needsChanges(ctx, page, [NO_EMAIL]);
        continue;
      }
      if (kind === "news") {
        await publishNews(ctx, page, email, programmes);
      } else if (read.select(page, "Status") === CANCEL) {
        await cancelEvent(ctx, page, email);
      } else {
        await publishEvent(ctx, page, email, programmes);
      }
    } catch (error) {
      problem(ctx, `${kind} ${bareId(page.id)}: ${(error as Error).message}`);
    }
  }
};

const EVENT_STATUS: Record<string, string> = {
  cancelled: "Canceled",
  draft: "Planning",
  published: "Published",
};

const ADOPTED_NOTE =
  "Made in the Nexus; its text is still there. Write it here under English and العربية before publishing from here.";

const adoptEvents = async (ctx: SyncContext) => {
  const [events, links] = await Promise.all([
    ctx.admin
      .schema("events")
      .from("events")
      .select(
        "id, slug, title_en, title_ar, starts_at, ends_at, status, capacity"
      )
      .gte("starts_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    linksOf(ctx, "event"),
  ]);
  for (const e of events.data ?? []) {
    if (links.has(e.id) || outOfTime(ctx)) {
      continue;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
      const page = await ctx.notion.createPage(ctx.sources.events, {
        Capacity: prop.number(e.capacity),
        Nexus: prop.url(`${ctx.appUrl}/en/admin/events/edit?id=${e.id}`),
        "Nexus ID": prop.text(e.id),
        "Platform note": prop.text(ADOPTED_NOTE),
        "Public page": prop.url(
          e.status === "published" ? `${ctx.webUrl}/en/events/${e.slug}` : null
        ),
        Slug: prop.text(e.slug),
        Status: prop.select(EVENT_STATUS[e.status] ?? "Planning"),
        Title: prop.title(e.title_en),
        "Title (Arabic)": prop.text(e.title_ar),
        When: prop.date(e.starts_at, e.ends_at),
      });
      await saveLink(ctx, "event", page.id, e.id, null);
      count(ctx, "event.adopted");
    } catch (error) {
      problem(ctx, `event ${e.id}: ${(error as Error).message}`);
    }
  }
};

const adoptNews = async (ctx: SyncContext) => {
  const [news, links] = await Promise.all([
    ctx.admin
      .schema("content")
      .from("news_posts")
      .select("id, slug, title_en, title_ar, status, publish_at, published_at")
      .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
    linksOf(ctx, "news"),
  ]);
  for (const n of news.data ?? []) {
    if (links.has(n.id) || outOfTime(ctx)) {
      continue;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
      const page = await ctx.notion.createPage(ctx.sources.news, {
        Kind: prop.select("News post"),
        Nexus: prop.url(`${ctx.appUrl}/en/admin/content/news?id=${n.id}`),
        "Nexus ID": prop.text(n.id),
        "Platform note": prop.text(ADOPTED_NOTE),
        "Public page": prop.url(
          n.status === "published" ? `${ctx.webUrl}/en/news/${n.slug}` : null
        ),
        "Publish on": prop.date(n.publish_at ?? n.published_at),
        Slug: prop.text(n.slug),
        Status: prop.select(n.status === "draft" ? "Drafting" : "Published"),
        Title: prop.title(n.title_en),
        "Title (Arabic)": prop.text(n.title_ar),
      });
      await saveLink(ctx, "news", page.id, n.id, null);
      count(ctx, "news.adopted");
    } catch (error) {
      problem(ctx, `news ${n.id}: ${(error as Error).message}`);
    }
  }
};

/**
 * Events and news made in the Nexus get a page in Notion too, so the
 * calendar is complete and the team can take them over there. Their text
 * stays in the Nexus until someone writes it in the page.
 */
export const adoptNexusItems = async (ctx: SyncContext) => {
  await adoptEvents(ctx);
  await adoptNews(ctx);
};

/** Confirmed RSVPs per event, written back when the number changed. */
export const syncRsvpCounts = async (ctx: SyncContext) => {
  const links = await linksOf(ctx, "event");
  if (links.size === 0) {
    return;
  }
  const { data } = await ctx.admin
    .schema("events")
    .from("rsvps")
    .select("event_id")
    .eq("status", "confirmed")
    .in("event_id", [...links.keys()]);
  const tally = new Map<string, number>();
  for (const r of data ?? []) {
    tally.set(r.event_id, (tally.get(r.event_id) ?? 0) + 1);
  }
  for (const [eventId, link] of links) {
    if (outOfTime(ctx)) {
      return;
    }
    const total = tally.get(eventId) ?? 0;
    const marker = `rsvps:${total}`;
    if (link.content_hash === marker) {
      continue;
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: rate-limited, sequential
      await ctx.notion.updatePage(link.notion_page_id, {
        RSVPs: prop.number(total),
      });
      await saveLink(ctx, "event", link.notion_page_id, eventId, marker);
      count(ctx, "event.rsvps");
    } catch (error) {
      problem(ctx, `rsvps ${eventId}: ${(error as Error).message}`);
    }
  }
};

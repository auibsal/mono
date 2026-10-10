import { env } from "@/env";
import { hasBearer } from "@/lib/bearer";
import { runNotionSync } from "@/lib/notion/run";

export const maxDuration = 60;

/**
 * Every five minutes (pg_cron `sal-notion-sync`): the team's Notion
 * workspace. Mirrors officers, programs, the document and minutes registry
 * and Journal counts into Notion, publishes events and news set to Ready to
 * publish there, and writes RSVP counts back. Does nothing without
 * NOTION_TOKEN.
 */
const sync = async (request: Request) => {
  if (!hasBearer(request, env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runNotionSync());
};

export const GET = sync;
export const POST = sync;

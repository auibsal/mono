import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { env } from "@/env";
import { cacheTags } from "@/lib/supabase";

const authorized = (request: Request) => {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};

/**
 * POST { tags: ["events", …] } with `Authorization: Bearer <REVALIDATE_SECRET>`.
 * Called by apps/api when publish-relevant rows change.
 */
export const POST = async (request: Request) => {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is (typeof cacheTags)[number] =>
        (cacheTags as readonly unknown[]).includes(tag)
      )
    : [];

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return Response.json({ revalidated: tags });
};

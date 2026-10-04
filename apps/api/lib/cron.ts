import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the
 * `CRON_SECRET` environment variable is set on the project. Fails closed: if
 * the secret is not configured, every request is rejected.
 */
export const isAuthorizedCronRequest = (request: Request): boolean => {
  const secret = env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};

export const unauthorized = () => new Response("Unauthorized", { status: 401 });

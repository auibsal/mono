import "server-only";

import { project } from "@repo/config";
import type { AdminClient } from "@repo/database/admin";
import { log } from "@repo/observability/log";
import webpush from "web-push";
import { env } from "@/env";

/**
 * Web Push: notices on members' phones and browsers, alongside the email.
 * The browser vendors' push services deliver them free of charge; we sign
 * each one with the Society's VAPID key. Email stays the record, so a push
 * that fails is logged and never fails the outbox row. A device whose push
 * service answers 404 or 410 has gone away and is removed.
 */

export interface PushNotice {
  body: string;
  lang: "en" | "ar";
  /** Collapses repeats of the same notice on the device. */
  tag?: string;
  title: string;
  /** A Nexus URL, opened when the notice is tapped. */
  url: string;
}

const GONE = new Set([404, 410]);
const DAY = 24 * 60 * 60;

export const pushConfigured = () =>
  Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** Sends to every device of the member; returns how many took it. */
export const pushToUser = async (
  admin: AdminClient,
  userId: string,
  notice: PushNotice
): Promise<number> => {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!(publicKey && privateKey)) {
    return 0;
  }
  const { data: devices } = await admin
    .schema("core")
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  const results = await Promise.all(
    (devices ?? []).map(async (device) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { auth: device.auth, p256dh: device.p256dh },
          },
          JSON.stringify(notice),
          {
            TTL: DAY,
            urgency: "normal",
            vapidDetails: {
              privateKey,
              publicKey,
              subject: `mailto:${project.supportEmail}`,
            },
          }
        );
        return true;
      } catch (error) {
        const status =
          error instanceof webpush.WebPushError ? error.statusCode : 0;
        if (GONE.has(status)) {
          await admin
            .schema("core")
            .from("push_subscriptions")
            .delete()
            .eq("id", device.id);
        } else {
          log.warn("Push failed", { status });
        }
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
};

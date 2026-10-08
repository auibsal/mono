import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { AdminClient } from "@repo/database/admin";
import { EmailQuotaError, sendEmail } from "@repo/email";
import {
  agreementReminder,
  type Built,
  type Lang as CopyLang,
  type Decision,
  decision,
  eventReminder,
  removalReceived,
  removalRequested,
  returnedForFormatting,
  roleEnding,
  rsvpConfirmed,
  submissionReceived,
  waitlistPromoted,
} from "@repo/email/copy";
import { Notice } from "@repo/email/templates/notice";
import { env } from "@/env";
import { pushToUser } from "./push";

/**
 * Processes core.outbox rows: the emails and site revalidation queued by
 * database triggers and the daily notices. Each row is claimed (attempts
 * is incremented) before work starts and marked processed when it is done;
 * a failure records the error and leaves the row for the next drain, up to
 * MAX_ATTEMPTS. When the email plan's daily limit is spent, the claim is
 * given back and the row waits for the limit to reset: it is delayed, not
 * lost. Each email carries an idempotency key, so a retried row never sends
 * the same email twice. Members who turned on phone notifications also get
 * the notice on their devices, after the email has gone.
 */
export const MAX_ATTEMPTS = 5;

type Lang = CopyLang;
interface OutboxRow {
  attempts: number;
  id: number;
  kind: string;
  payload: Record<string, unknown>;
}

const TRAILING_SLASH = /\/$/;

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(TRAILING_SLASH, "");

interface Recipient {
  email: string;
  lang: Lang;
  /** Set for members (push goes to their devices); unset for guests. */
  userId?: string;
}

const recipient = async (
  admin: AdminClient,
  userId: unknown
): Promise<Recipient | null> => {
  if (typeof userId !== "string") {
    return null;
  }
  const [{ data: user }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .schema("core")
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const email = user?.user?.email;
  if (!email) {
    return null;
  }
  return { email, lang: profile?.locale === "ar" ? "ar" : "en", userId };
};

/** The outbox row being processed: for idempotency keys and push. */
const current = new AsyncLocalStorage<{ admin: AdminClient; row: number }>();

/** The push version of a notice: its heading and first line, in their language. */
const pushNotice = (built: Built, lang: Lang, row: number | undefined) => {
  const block = built.blocks.find((b) => b.lang === lang) ?? built.blocks[0];
  return {
    body: block?.paragraphs[0] ?? "",
    lang,
    tag: row === undefined ? undefined : `outbox-${row}`,
    title: block?.heading ?? built.subject,
    url: block?.action?.href ?? `${appUrl()}/${lang}`,
  };
};

const send = async (to: Recipient, built: Built) => {
  const run = current.getStore();
  const row = run?.row;
  await sendEmail({
    idempotencyKey: row === undefined ? undefined : `outbox-${row}-${to.email}`,
    react: Notice({ blocks: built.blocks, preview: built.preview }),
    subject: built.subject,
    to: to.email,
  });
  if (run && to.userId) {
    // Never throws: email is the record.
    await pushToUser(run.admin, to.userId, pushNotice(built, to.lang, row));
  }
};

const eventInfo = async (admin: AdminClient, eventId: unknown) => {
  const { data } = await admin
    .schema("events")
    .from("events")
    .select("title_en, title_ar, starts_at, venue_en, venue_ar")
    .eq("id", String(eventId))
    .maybeSingle();
  return data;
};

const submissionTitle = async (admin: AdminClient, submissionId: unknown) => {
  const { data } = await admin
    .schema("journal")
    .from("submissions")
    .select("title")
    .eq("id", String(submissionId))
    .maybeSingle();
  return data?.title ?? null;
};

/** Holders of programmes.manage for the program (or globally). */
const programmeManagers = async (
  admin: AdminClient,
  programmeId: unknown
): Promise<Recipient[]> => {
  const { data: holders } = await admin
    .schema("access")
    .rpc("permission_holders", {
      permission: "programmes.manage",
      scope_id: typeof programmeId === "string" ? programmeId : undefined,
      scope_type: "programme",
    });
  const found = await Promise.all(
    (holders ?? []).map((h) => recipient(admin, h.user_id))
  );
  return found.filter((r): r is Recipient => r !== null);
};

const removalInfo = async (admin: AdminClient, requestId: unknown) => {
  const { data } = await admin
    .schema("programmes")
    .from("removal_requests")
    .select("requester_name, requester_email, content_url, details, due_at")
    .eq("id", String(requestId))
    .maybeSingle();
  return data;
};

const revalidate = async (tags: unknown) => {
  if (!(env.REVALIDATE_SECRET && Array.isArray(tags) && tags.length)) {
    return;
  }
  const response = await fetch(
    `${env.NEXT_PUBLIC_WEB_URL.replace(TRAILING_SLASH, "")}/api/revalidate`,
    {
      body: JSON.stringify({ tags }),
      headers: {
        authorization: `Bearer ${env.REVALIDATE_SECRET}`,
        "content-type": "application/json",
      },
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`Revalidation failed: ${response.status}`);
  }
};

type Handler = (
  admin: AdminClient,
  payload: Record<string, unknown>
) => Promise<void>;

const eventNotice =
  (make: typeof rsvpConfirmed): Handler =>
  async (admin, payload) => {
    const [to, event] = await Promise.all([
      recipient(admin, payload.user_id),
      eventInfo(admin, payload.event_id),
    ]);
    if (to && event) {
      await send(to, make(to.lang, event, appUrl()));
    }
  };

const handlers: Record<string, Handler> = {
  "access.role_ending": async (admin, payload) => {
    const to = await recipient(admin, payload.user_id);
    const { data } = await admin
      .schema("access")
      .from("role_assignments")
      .select("ends_at, title_en, title_ar, role:roles(name_en, name_ar)")
      .eq("id", String(payload.assignment_id))
      .maybeSingle();
    if (to && data?.ends_at && data.role) {
      await send(
        to,
        roleEnding(
          to.lang,
          {
            ends_at: data.ends_at,
            name_ar: data.title_ar ?? data.role.name_ar,
            name_en: data.title_en ?? data.role.name_en,
          },
          appUrl()
        )
      );
    }
  },
  "events.reminder": eventNotice(eventReminder),
  "events.rsvp_confirmed": eventNotice(rsvpConfirmed),
  "events.waitlist_promoted": eventNotice(waitlistPromoted),
  "journal.agreement_reminder": async (admin, payload) => {
    const [to, work] = await Promise.all([
      recipient(admin, payload.user_id),
      submissionTitle(admin, payload.submission_id),
    ]);
    if (to && work) {
      await send(to, agreementReminder(to.lang, work, appUrl()));
    }
  },
  "journal.decision": async (admin, payload) => {
    const [to, work] = await Promise.all([
      recipient(admin, payload.user_id),
      submissionTitle(admin, payload.submission_id),
    ]);
    const outcome = payload.decision as Decision;
    if (
      to &&
      work &&
      ["accept", "accept_with_edits", "decline"].includes(outcome)
    ) {
      await send(to, decision(to.lang, work, outcome, appUrl()));
    }
  },
  "journal.returned_for_formatting": async (admin, payload) => {
    const [to, work] = await Promise.all([
      recipient(admin, payload.user_id),
      submissionTitle(admin, payload.submission_id),
    ]);
    if (to && work) {
      await send(
        to,
        returnedForFormatting(
          to.lang,
          work,
          typeof payload.note === "string" ? payload.note : "",
          appUrl()
        )
      );
    }
  },
  "journal.submission_received": async (admin, payload) => {
    const [to, work] = await Promise.all([
      recipient(admin, payload.user_id),
      submissionTitle(admin, payload.submission_id),
    ]);
    if (to && work) {
      await send(to, submissionReceived(to.lang, work, appUrl()));
    }
  },
  "programmes.removal_overdue": async (admin, payload) => {
    const [request, managers] = await Promise.all([
      removalInfo(admin, payload.request_id),
      programmeManagers(admin, payload.programme_id),
    ]);
    if (request) {
      await Promise.all(
        managers.map((m) =>
          send(m, removalRequested(m.lang, request, appUrl(), true))
        )
      );
    }
  },
  "programmes.removal_requested": async (admin, payload) => {
    const [request, managers] = await Promise.all([
      removalInfo(admin, payload.request_id),
      programmeManagers(admin, payload.programme_id),
    ]);
    if (!request) {
      return;
    }
    await Promise.all([
      ...managers.map((m) =>
        send(m, removalRequested(m.lang, request, appUrl()))
      ),
      // The requester has no account; write in English with Arabic below.
      send(
        { email: request.requester_email, lang: "en" },
        removalReceived("en", request.due_at)
      ),
    ]);
  },
  revalidate: async (_admin, payload) => {
    await revalidate(payload.tags);
  },
};

/** Claims and processes one row; true when it is done (or not ours to do). */
export const processRow = async (admin: AdminClient, id: number) => {
  const { data: row } = await admin
    .schema("core")
    .from("outbox")
    .select("id, kind, payload, attempts")
    .eq("id", id)
    .is("processed_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .maybeSingle();
  if (!row) {
    return true;
  }
  const previousAttempts = row.attempts;
  const claimed = await admin
    .schema("core")
    .from("outbox")
    .update({ attempts: row.attempts + 1 })
    .eq("id", id)
    .eq("attempts", row.attempts)
    .select("id")
    .maybeSingle();
  if (!claimed.data) {
    // Someone else took it.
    return true;
  }
  const handler = Object.hasOwn(handlers, row.kind)
    ? handlers[row.kind]
    : undefined;
  try {
    if (handler) {
      await current.run({ admin, row: id }, () =>
        handler(admin, (row as OutboxRow).payload)
      );
    }
    await admin
      .schema("core")
      .from("outbox")
      .update({
        last_error: handler ? null : "no handler",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return true;
  } catch (error) {
    const quota = error instanceof EmailQuotaError;
    await admin
      .schema("core")
      .from("outbox")
      .update({
        // A spent sending limit is not the row's fault: give the try back.
        ...(quota ? { attempts: previousAttempts } : {}),
        last_error: String(
          error instanceof Error ? error.message : error
        ).slice(0, 1000),
      })
      .eq("id", id);
    if (quota) {
      throw error;
    }
    return false;
  }
};

/** Pending rows older than two minutes (the trigger handles fresh ones). */
export const drain = async (admin: AdminClient, limit = 50) => {
  const { data: rows } = await admin
    .schema("core")
    .from("outbox")
    .select("id")
    .is("processed_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .lt("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(limit);
  let done = 0;
  for (const row of rows ?? []) {
    try {
      // One at a time: Resend's rate limit is per second.
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose
      if (await processRow(admin, row.id)) {
        done += 1;
      }
    } catch (error) {
      if (error instanceof EmailQuotaError) {
        // The rest would fail the same way; they wait for the next drain.
        return { done, quotaReached: true, seen: rows?.length ?? 0 };
      }
      throw error;
    }
  }
  return { done, quotaReached: false, seen: rows?.length ?? 0 };
};

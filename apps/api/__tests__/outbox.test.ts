// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const sendEmail = vi.fn();
const pushToUser = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://nexus.auibsal.org" },
}));
vi.mock("@repo/email", () => ({
  EmailQuotaError: class extends Error {},
  sendEmail,
}));

vi.mock("@/lib/push", () => ({ pushToUser }));

const { EmailQuotaError } = await import("@repo/email");
const { drain, processRow } = await import("@/lib/outbox");

interface Row {
  attempts: number;
  id: number;
  kind: string;
  last_error?: string | null;
  payload: Record<string, unknown>;
  processed_at?: string | null;
}

/** A tiny stand-in for the admin client: just the calls the outbox makes. */
const fakeAdmin = (rows: Row[]) => {
  const query = () => {
    let filters: [string, unknown][] = [];
    let patch: Partial<Row> | null = null;
    const matches = () =>
      rows.filter((r) =>
        filters.every(([k, v]) => {
          if (k === "is") {
            return r.processed_at === null || r.processed_at === undefined;
          }
          if (k === "lt.attempts") {
            return r.attempts < (v as number);
          }
          if (k === "lt.created_at") {
            return true;
          }
          return (r as unknown as Record<string, unknown>)[k] === v;
        })
      );
    const api = {
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return api;
      },
      is: () => {
        filters.push(["is", null]);
        return api;
      },
      limit: () => Promise.resolve({ data: matches() }),
      lt: (k: string, v: unknown) => {
        filters.push([`lt.${k}`, v]);
        return api;
      },
      maybeSingle: () => {
        const found = matches()[0] ?? null;
        if (patch && found) {
          Object.assign(found, patch);
        }
        return Promise.resolve({ data: found });
      },
      order: () => api,
      select: () => api,
      // biome-ignore lint/suspicious/noThenProperty: awaited like the client
      then: (resolve: (v: unknown) => void) => {
        if (patch) {
          for (const r of matches()) {
            Object.assign(r, patch);
          }
        }
        resolve({ data: null });
      },
      update: (p: Partial<Row>) => {
        patch = p;
        filters = [];
        return api;
      },
    };
    return api;
  };
  return {
    auth: {
      admin: {
        getUserById: () =>
          Promise.resolve({ data: { user: { email: "m@auib.edu.iq" } } }),
      },
    },
    schema: () => ({
      from: (table: string) => (table === "outbox" ? query() : profileQuery()),
    }),
  } as never;
};

const profileQuery = () => {
  const api = {
    eq: () => api,
    maybeSingle: () =>
      Promise.resolve({
        data: { locale: "en", title: "The paper and the pen" },
      }),
    select: () => api,
  };
  return api;
};

const submissionRow = (id: number): Row => ({
  attempts: 0,
  id,
  kind: "journal.submission_received",
  payload: { submission_id: "s1", user_id: "u1" },
});

describe("outbox and the email sending limit", () => {
  beforeEach(() => {
    sendEmail.mockReset();
    pushToUser.mockReset();
  });

  test("each email carries an idempotency key for its row", async () => {
    sendEmail.mockResolvedValue({ id: "e1" });
    const rows = [submissionRow(7)];
    expect(await processRow(fakeAdmin(rows), 7)).toBe(true);
    expect(sendEmail.mock.calls[0][0].idempotencyKey).toBe(
      "outbox-7-m@auib.edu.iq"
    );
    expect(rows[0].processed_at).toBeTruthy();
  });

  test("a spent daily limit gives the try back instead of using it up", async () => {
    sendEmail.mockRejectedValue(new EmailQuotaError("daily limit"));
    const rows = [submissionRow(1), submissionRow(2)];
    const result = await drain(fakeAdmin(rows));
    expect(result).toEqual({ done: 0, quotaReached: true, seen: 2 });
    expect(rows.map((r) => r.attempts)).toEqual([0, 0]);
    expect(rows.every((r) => !r.processed_at)).toBe(true);
    // The drain stops at the first spent limit: the second row is untouched.
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test("other failures still count toward the retry limit", async () => {
    sendEmail.mockRejectedValue(new Error("invalid address"));
    const rows = [submissionRow(3)];
    expect(await processRow(fakeAdmin(rows), 3)).toBe(false);
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].last_error).toBe("invalid address");
  });

  test("members also get the notice on their devices, after the email", async () => {
    sendEmail.mockResolvedValue({ id: "e1" });
    pushToUser.mockResolvedValue(1);
    await processRow(fakeAdmin([submissionRow(8)]), 8);
    expect(pushToUser).toHaveBeenCalledTimes(1);
    const [, userId, notice] = pushToUser.mock.calls[0];
    expect(userId).toBe("u1");
    expect(notice).toMatchObject({ lang: "en", tag: "outbox-8" });
    expect(notice.title).toContain("The paper and the pen");
    expect(notice.url.startsWith("https://nexus.auibsal.org/en")).toBe(true);
  });

  test("no push goes out when the email fails, so a retry sends it once", async () => {
    sendEmail.mockRejectedValue(new Error("invalid address"));
    await processRow(fakeAdmin([submissionRow(9)]), 9);
    expect(pushToUser).not.toHaveBeenCalled();
  });
});

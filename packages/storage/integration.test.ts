/**
 * Runs against a local Supabase stack (API_URL, PUBLISHABLE_KEY, SECRET_KEY
 * from `supabase status -o env`):
 *   SUPABASE_INTEGRATION=1 bun run --cwd packages/storage test
 *
 * Acceptance: no submission or receipt file is reachable without a valid
 * signed URL.
 */
import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";
import {
  buckets,
  createSignedFileUrl,
  StorageError,
  uploadReceipt,
  uploadSubmissionFile,
} from "./index";

const url = process.env.API_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.PUBLISHABLE_KEY ?? "";
// createClient needs a key even when the suite is skipped.
const placeholderKey = "skipped";
const secretKey = process.env.SECRET_KEY ?? "";

describe.skipIf(
  !(process.env.SUPABASE_INTEGRATION && publishableKey && secretKey)
)("storage (local Supabase)", () => {
  const stamp = Date.now();
  const password = "integration-test-1";
  const admin = createClient<Database>(url, secretKey || placeholderKey, {
    auth: { persistSession: false },
  });
  const anon = createClient<Database>(url, publishableKey || placeholderKey, {
    auth: { persistSession: false },
  });
  const signIn = async (email: string) => {
    const client = createClient<Database>(
      url,
      publishableKey || placeholderKey,
      { auth: { persistSession: false } }
    );
    await client.auth.signInWithPassword({ email, password });
    return client;
  };
  const pdf = () =>
    new File(["%PDF-1.4 test"], "My Name - Poem.pdf", {
      type: "application/pdf",
    });
  let submissionId = "";
  let filePath = "";

  beforeAll(async () => {
    const [authorId = ""] = await Promise.all(
      ["author", "other"].map(async (name) => {
        const { data } = await admin.auth.admin.createUser({
          email: `${name}${stamp}@auib.edu.iq`,
          email_confirm: true,
          password,
        });
        return data.user?.id ?? "";
      })
    );
    await admin
      .schema("membership")
      .from("pledges")
      .insert([
        {
          pledge_type: "human_authorship",
          user_id: authorId,
          version: "1",
        },
        { pledge_type: "member", user_id: authorId, version: "1" },
      ]);
    const issue = await admin
      .schema("journal")
      .from("issues")
      .insert({
        number: (stamp % 900) + 1,
        slug: `st-${stamp}`,
        title_ar: "ت",
        title_en: "ST",
        volume: 98,
      })
      .select("id")
      .single();
    const call = await admin
      .schema("journal")
      .from("calls")
      .insert({
        closes_at: new Date(Date.now() + 86_400_000).toISOString(),
        is_published: true,
        issue_id: issue.data?.id ?? "",
        opens_at: new Date(Date.now() - 86_400_000).toISOString(),
        title_ar: "ت",
        title_en: "ST",
      })
      .select("id")
      .single();
    const author = await signIn(`author${stamp}@auib.edu.iq`);
    const submission = await author
      .schema("journal")
      .from("submissions")
      .insert({
        call_id: call.data?.id ?? "",
        category: "poetry",
        human_authorship_confirmed: true,
        language: "en",
        title: "Upload test",
      })
      .select("id")
      .single();
    submissionId = submission.data?.id ?? "";
  });

  test("the author uploads under a random name that hides the original", async () => {
    const author = await signIn(`author${stamp}@auib.edu.iq`);
    const stored = await uploadSubmissionFile(author, submissionId, pdf());
    filePath = stored.path;
    expect(filePath).toMatch(
      new RegExp(`^${submissionId}/[0-9a-f-]{36}\\.pdf$`)
    );
    expect(filePath).not.toContain("Name");
  });

  test("nobody downloads a submission without a signed URL", async () => {
    const author = await signIn(`author${stamp}@auib.edu.iq`);
    const other = await signIn(`other${stamp}@auib.edu.iq`);
    const results = await Promise.all(
      [anon, other, author].map((client) =>
        client.storage.from(buckets.submissions.id).download(filePath)
      )
    );
    for (const { data, error } of results) {
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    }
    const {
      data: { publicUrl },
    } = admin.storage.from(buckets.submissions.id).getPublicUrl(filePath);
    expect((await fetch(publicUrl)).ok).toBe(false);
  });

  test("a signed URL from the API works, briefly", async () => {
    const signed = await createSignedFileUrl(admin, "submissions", filePath, {
      expiresIn: 60,
    });
    expect((await fetch(signed)).ok).toBe(true);
  });

  test("other members cannot write into someone else's submission", async () => {
    const other = await signIn(`other${stamp}@auib.edu.iq`);
    await expect(
      uploadSubmissionFile(other, submissionId, pdf())
    ).rejects.toBeInstanceOf(StorageError);
  });

  test("receipts are closed to members and visitors", async () => {
    const other = await signIn(`other${stamp}@auib.edu.iq`);
    await expect(
      uploadReceipt(other, "00000000-0000-4000-8000-000000000000", pdf())
    ).rejects.toBeInstanceOf(StorageError);
    const { data } = await anon.storage.from(buckets.receipts.id).list("");
    expect(data ?? []).toEqual([]);
  });
});

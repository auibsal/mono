/**
 * Acceptance: a reader's browser never receives an author's name, email or
 * id before a decision. Checks the raw API responses a reader can get.
 * Needs a local stack: SUPABASE_INTEGRATION=1 API_URL=… PUBLISHABLE_KEY=… SECRET_KEY=…
 */
import type { Database } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";

const url = process.env.API_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.PUBLISHABLE_KEY ?? "";
// createClient needs a key even when the suite is skipped.
const placeholderKey = "skipped";
const secretKey = process.env.SECRET_KEY ?? "";
const enabled = Boolean(
  process.env.SUPABASE_INTEGRATION && publishableKey && secretKey
);

describe.skipIf(!enabled)("blind review over the Data API", () => {
  const stamp = Date.now();
  const password = "integration-test-1";
  const admin = createClient<Database>(url, secretKey || placeholderKey, {
    auth: { persistSession: false },
  });
  const as = async (email: string) => {
    const client = createClient<Database>(
      url,
      publishableKey || placeholderKey,
      { auth: { persistSession: false } }
    );
    const { error } = await client.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();
    return client;
  };
  const people = {
    author: {
      email: `author${stamp}@auib.edu.iq`,
      id: "",
      name: `Hidden Author ${stamp}`,
    },
    manager: { email: `sm${stamp}@auib.edu.iq`, id: "", name: "Manager" },
    reader: { email: `reader${stamp}@auib.edu.iq`, id: "", name: "Reader" },
  };
  let issueId = "";
  let callId = "";

  beforeAll(async () => {
    await Promise.all(
      Object.values(people).map(async (person) => {
        const { data, error } = await admin.auth.admin.createUser({
          email: person.email,
          email_confirm: true,
          password,
          user_metadata: { full_name_en: person.name },
        });
        expect(error).toBeNull();
        person.id = data.user?.id ?? "";
      })
    );

    const journal = admin.schema("journal");
    const issue = await journal
      .from("issues")
      .insert({
        number: stamp % 1000,
        slug: `it-${stamp}`,
        title_ar: "ت",
        title_en: "IT",
        volume: 99,
      })
      .select("id")
      .single();
    issueId = issue.data?.id ?? "";
    const call = await journal
      .from("calls")
      .insert({
        closes_at: new Date(Date.now() + 86_400_000).toISOString(),
        is_published: true,
        issue_id: issueId,
        opens_at: new Date(Date.now() - 86_400_000).toISOString(),
        title_ar: "ت",
        title_en: "IT",
      })
      .select("id")
      .single();
    callId = call.data?.id ?? "";

    await admin
      .schema("access")
      .from("role_assignments")
      .insert([
        {
          role: "submissions_manager",
          scope_id: issueId,
          scope_type: "issue",
          user_id: people.manager.id,
        },
        {
          role: "reader",
          scope_id: issueId,
          scope_type: "issue",
          user_id: people.reader.id,
        },
      ]);
    await admin
      .schema("membership")
      .from("pledges")
      .insert([
        {
          pledge_type: "human_authorship",
          user_id: people.author.id,
          version: "1",
        },
        { pledge_type: "member", user_id: people.author.id, version: "1" },
      ]);
  });

  test("the reader's responses carry no author identity", async () => {
    const author = await as(people.author.email);
    const submission = await author
      .schema("journal")
      .from("submissions")
      .insert({
        body_html: "<p>A first poem</p>",
        call_id: callId,
        category: "poetry",
        human_authorship_confirmed: true,
        language: "en",
        title: "First light",
      })
      .select("id")
      .single();
    expect(submission.error).toBeNull();
    const submissionId = submission.data?.id ?? "";

    const manager = await as(people.manager.email);
    const journal = manager.schema("journal");
    await journal.rpc("transition_submission", {
      id: submissionId,
      to_status: "intake_check",
    });
    await journal.rpc("transition_submission", {
      id: submissionId,
      to_status: "in_review",
    });
    const key = await journal
      .from("blind_keys")
      .select("blind_entry_id")
      .eq("submission_id", submissionId)
      .single();
    const entryId = key.data?.blind_entry_id ?? "";
    const assigned = await journal.rpc("assign_reader", {
      blind_entry_id: entryId,
      read_number: 1,
      reader_id: people.reader.id,
    });
    expect(assigned.error).toBeNull();

    const reader = await as(people.reader.email);
    const rj = reader.schema("journal");
    const responses = await Promise.all([
      rj.from("blind_entries").select("*"),
      rj.from("assignments").select("*, entry:blind_entries(*)"),
      rj.from("submissions").select("*"),
      rj.from("blind_keys").select("*"),
      rj.from("status_history").select("*"),
      rj.from("submission_files").select("*"),
      rj.rpc("entry_author", { blind_entry_id: entryId }),
      reader.schema("core").from("activity_log").select("*"),
    ]);

    const blind = responses[0].data ?? [];
    expect(blind).toHaveLength(1);
    expect(blind[0]?.title).toBe("First light");

    const everything = JSON.stringify(responses.map((r) => r.data));
    expect(everything).not.toContain(people.author.id);
    expect(everything).not.toContain(people.author.email);
    expect(everything).not.toContain(people.author.name);
    expect(everything).not.toContain(submissionId);
  });
});

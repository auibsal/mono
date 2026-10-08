import { admin, editor, event, member, PASSWORD } from "./fixtures";

/**
 * Seeds what the journeys need, idempotently: a member who has finished
 * setup, an editor holding the Technical Administrator role (no two-step
 * requirement), one upcoming event and one open Journal call.
 */
const ensureUser = async (email: string, name: string) => {
  const db = admin();
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const found = data.users.find((u) => u.email === email);
  if (found) {
    return found.id;
  }
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    password: PASSWORD,
    user_metadata: { full_name_en: name },
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("user not created");
  }
  return created.data.user.id;
};

export default async function globalSetup() {
  const db = admin();
  const memberId = await ensureUser(member.email, member.name);
  const editorId = await ensureUser(editor.email, editor.name);

  for (const id of [memberId, editorId]) {
    const versions = await db
      .schema("core")
      .from("settings")
      .select("key, value")
      .like("key", "pledges.%.version");
    for (const row of versions.data ?? []) {
      const kind =
        row.key.split(".")[1] === "human_authorship"
          ? "human_authorship"
          : "member";
      await db
        .schema("membership")
        .from("pledges")
        .upsert(
          {
            pledge_type: kind,
            user_id: id,
            version: String(row.value).replace(/"/g, ""),
          },
          { ignoreDuplicates: true, onConflict: "user_id,pledge_type,version" }
        );
    }
    await db
      .schema("core")
      .from("profiles")
      .update({ setup_completed_at: new Date().toISOString() })
      .eq("id", id);
  }

  await db
    .schema("access")
    .from("role_assignments")
    .upsert(
      { role: "tech_admin", scope_type: "global", user_id: editorId },
      { ignoreDuplicates: true }
    );

  const start = new Date(Date.now() + 5 * 86_400_000);
  await db.schema("events").from("events").upsert(
    {
      capacity: 30,
      published_at: new Date().toISOString(),
      slug: event.slug,
      starts_at: start.toISOString(),
      status: "published",
      summary_ar: "اقرأ صفحة تحبها.",
      summary_en: "Read a page you love.",
      title_ar: "صفحات مفتوحة (اختبار)",
      title_en: event.title,
      venue_en: "Library",
    },
    { onConflict: "slug" }
  );

  const issue = await db
    .schema("journal")
    .from("issues")
    .upsert(
      {
        number: 1,
        slug: "e2e-issue",
        title_ar: "عدد الاختبار",
        title_en: "E2E Issue",
        volume: 99,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  const issueId = issue.data?.id;
  const existing = await db
    .schema("journal")
    .from("calls")
    .select("id")
    .eq("issue_id", issueId ?? "");
  if (issueId && (existing.data ?? []).length === 0) {
    await db
      .schema("journal")
      .from("calls")
      .insert({
        closes_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        is_published: true,
        issue_id: issueId,
        max_per_person: 10,
        opens_at: new Date(Date.now() - 86_400_000).toISOString(),
        title_ar: "دعوة الاختبار",
        title_en: "E2E call",
      });
  }
}

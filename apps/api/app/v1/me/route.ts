import { unwrap } from "@repo/sal-data/client";
import { json, member, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/**
 * GET /v1/me: who signed in. The profile needs the app's "profile" area;
 * permissions (what the member may do, by scope) are always available.
 */
export const GET = member(async ({ clientId, supabase, userId }) => {
  const [profile, permissions] = await Promise.all([
    supabase
      .schema("core")
      .from("profiles")
      .select("full_name_en, full_name_ar, locale, verified_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.schema("access").rpc("my_permissions"),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return json({
    app: clientId,
    email: user?.email ?? null,
    id: userId,
    permissions: unwrap(permissions) ?? [],
    profile: profile.data
      ? {
          locale: profile.data.locale,
          name_ar: profile.data.full_name_ar,
          name_en: profile.data.full_name_en,
          verified: profile.data.verified_at !== null,
        }
      : null,
  });
});

import { createAdminClient } from "@repo/database/admin";
import { isAuthorizedCronRequest, unauthorized } from "@/lib/cron";

// Touches the database daily so free-tier Supabase projects are not paused.
export const GET = async (request: Request) => {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorized();
  }

  const { error } = await createAdminClient()
    .from("plans")
    .select("id")
    .limit(1);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response("OK", { status: 200 });
};

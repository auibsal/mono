import { createAdminClient } from "@repo/database/admin";
import { memberFeed } from "@/lib/calendar";
import { icsResponse, renderCalendar } from "@/lib/ics";

const TOKEN = /^[0-9a-f]{48}$/;
const ICS_SUFFIX = /\.ics$/;

/** GET /calendar/feed/<token>.ics — a member's private iCal feed. */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) => {
  const token = (await params).token.replace(ICS_SUFFIX, "");
  if (!TOKEN.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const feed = await memberFeed(createAdminClient(), token);
  if (!feed) {
    return new Response("Not found", { status: 404 });
  }

  const name =
    feed.locale === "ar"
      ? "جمعية الفنون والآداب"
      : "SAL · AUIB Society of Arts and Letters";
  return icsResponse(renderCalendar(name, feed.events), "sal.ics");
};

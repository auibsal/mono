import { createAdminClient } from "@repo/database/admin";
import { publicEvents } from "@/lib/calendar";
import { icsResponse, renderCalendar } from "@/lib/ics";

/** GET /calendar/sal.ics?lang=ar — every public SAL event (no members-only events). */
export const GET = async (request: Request) => {
  const locale =
    new URL(request.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const events = await publicEvents(createAdminClient(), locale);
  return icsResponse(
    renderCalendar("SAL · AUIB Society of Arts and Letters", events),
    "sal.ics"
  );
};

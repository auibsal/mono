import { createAdminClient } from "@repo/database/admin";
import { publicEvent } from "@/lib/calendar";
import { icsResponse, renderCalendar } from "@/lib/ics";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ICS_SUFFIX = /\.ics$/;

/** GET /calendar/events/<slug>.ics?lang=ar — "Add to calendar" for a public event. */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const slug = (await params).slug.replace(ICS_SUFFIX, "");
  const locale =
    new URL(request.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  if (!SLUG.test(slug)) {
    return new Response("Not found", { status: 404 });
  }

  const event = await publicEvent(createAdminClient(), slug, locale);
  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  return icsResponse(renderCalendar(event.title, [event]), `${slug}.ics`);
};

import { EventsBrowser } from "@/components/events/events-browser";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.events.title"));

const EventsPage = () => <EventsBrowser />;

export default EventsPage;

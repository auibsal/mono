import { RequireModule } from "@/components/admin/admin-shell";
import { EventsList } from "@/components/admin/events/list";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.admin.events.title"));

const EventsPage = () => (
  <RequireModule module="events">
    <EventsList />
  </RequireModule>
);

export default EventsPage;

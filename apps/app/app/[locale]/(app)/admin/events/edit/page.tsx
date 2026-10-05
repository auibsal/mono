import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { EventEditor } from "@/components/admin/events/editor";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.event.editTitle")
);

const EventEditPage = () => (
  <RequireModule module="events">
    <Suspense fallback={<SectionSpinner />}>
      <EventEditor />
    </Suspense>
  </RequireModule>
);

export default EventEditPage;

import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { CheckInScreen } from "@/components/admin/events/check-in";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.checkIn.title")
);

const CheckInPage = () => (
  <RequireModule module="events">
    <Suspense fallback={<SectionSpinner />}>
      <CheckInScreen />
    </Suspense>
  </RequireModule>
);

export default CheckInPage;

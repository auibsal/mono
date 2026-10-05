import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { MinutesEditor } from "@/components/admin/governance/minutes-editor";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.governance.tabs.minutes")
);

const MinutesPage = () => (
  <RequireModule module="governance">
    <Suspense fallback={<SectionSpinner />}>
      <MinutesEditor />
    </Suspense>
  </RequireModule>
);

export default MinutesPage;

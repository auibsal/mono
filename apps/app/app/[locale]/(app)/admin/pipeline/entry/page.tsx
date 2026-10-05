import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { EntryView } from "@/components/admin/pipeline/entry";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.pipeline.entry.title")
);

const Page = () => (
  <RequireModule module="pipeline">
    <Suspense fallback={<SectionSpinner />}>
      <EntryView />
    </Suspense>
  </RequireModule>
);

export default Page;

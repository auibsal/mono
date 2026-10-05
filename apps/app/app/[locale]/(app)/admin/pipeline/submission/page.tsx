import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { SubmissionView } from "@/components/admin/pipeline/intake";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.pipeline.submission.title")
);

const Page = () => (
  <RequireModule module="pipeline">
    <Suspense fallback={<SectionSpinner />}>
      <SubmissionView />
    </Suspense>
  </RequireModule>
);

export default Page;

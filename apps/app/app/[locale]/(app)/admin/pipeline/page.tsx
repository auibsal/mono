import { RequireModule } from "@/components/admin/admin-shell";
import { PipelineAdmin } from "@/components/admin/pipeline/pipeline";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.pipeline.title")
);

const Page = () => (
  <RequireModule module="pipeline">
    <PipelineAdmin />
  </RequireModule>
);

export default Page;

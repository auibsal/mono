import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { PageEditor } from "@/components/admin/content/page-editor";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.content.tabs.pages")
);

const PageEditPage = () => (
  <RequireModule module="content">
    <Suspense fallback={<SectionSpinner />}>
      <PageEditor />
    </Suspense>
  </RequireModule>
);

export default PageEditPage;

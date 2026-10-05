import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { NewsEditor } from "@/components/admin/content/news-editor";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.content.tabs.news")
);

const NewsEditPage = () => (
  <RequireModule module="content">
    <Suspense fallback={<SectionSpinner />}>
      <NewsEditor />
    </Suspense>
  </RequireModule>
);

export default NewsEditPage;

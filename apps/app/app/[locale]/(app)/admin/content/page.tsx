import { RequireModule } from "@/components/admin/admin-shell";
import { ContentAdmin } from "@/components/admin/content/sections";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.content.title")
);

const ContentPage = () => (
  <RequireModule module="content">
    <ContentAdmin />
  </RequireModule>
);

export default ContentPage;

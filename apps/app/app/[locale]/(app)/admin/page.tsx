import { RequireModule } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/overview";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.overview.title")
);

const AdminPage = () => (
  <RequireModule module="overview">
    <AdminOverview />
  </RequireModule>
);

export default AdminPage;

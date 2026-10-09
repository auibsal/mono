import { RequireModule } from "@/components/admin/admin-shell";
import { FormsAdmin } from "@/components/admin/forms/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.admin.forms.title"));

const FormsAdminPage = () => (
  <RequireModule module="forms">
    <FormsAdmin />
  </RequireModule>
);

export default FormsAdminPage;

import { RequireModule } from "@/components/admin/admin-shell";
import { DocumentsAdmin } from "@/components/admin/documents/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.documents.title")
);

const DocumentsAdminPage = () => (
  <RequireModule module="documents">
    <DocumentsAdmin />
  </RequireModule>
);

export default DocumentsAdminPage;

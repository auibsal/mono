import { RequireModule } from "@/components/admin/admin-shell";
import { ProgrammesAdmin } from "@/components/admin/programmes/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.programmes.title")
);

const ProgrammesPage = () => (
  <RequireModule module="programs">
    <ProgrammesAdmin />
  </RequireModule>
);

export default ProgrammesPage;

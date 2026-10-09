import { RequireModule } from "@/components/admin/admin-shell";
import { PartnersAdmin } from "@/components/admin/partners/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.partners.title")
);

const PartnersPage = () => (
  <RequireModule module="partners">
    <PartnersAdmin />
  </RequireModule>
);

export default PartnersPage;

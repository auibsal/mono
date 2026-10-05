import { RequireModule } from "@/components/admin/admin-shell";
import { GovernanceAdmin } from "@/components/admin/governance/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.governance.title")
);

const GovernancePage = () => (
  <RequireModule module="governance">
    <GovernanceAdmin />
  </RequireModule>
);

export default GovernancePage;

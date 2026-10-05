import { RequireModule } from "@/components/admin/admin-shell";
import { CharityAdmin } from "@/components/admin/charity/list";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.charity.title")
);

const CharityPage = () => (
  <RequireModule module="charity">
    <CharityAdmin />
  </RequireModule>
);

export default CharityPage;

import { RequireModule } from "@/components/admin/admin-shell";
import { MembersDirectory } from "@/components/admin/members/directory";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.members.title")
);

const MembersPage = () => (
  <RequireModule module="members">
    <MembersDirectory />
  </RequireModule>
);

export default MembersPage;

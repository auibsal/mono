import { RequireModule } from "@/components/admin/admin-shell";
import { VerificationQueue } from "@/components/admin/members/verification";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.verification.title")
);

const VerificationPage = () => (
  <RequireModule module="members">
    <VerificationQueue />
  </RequireModule>
);

export default VerificationPage;

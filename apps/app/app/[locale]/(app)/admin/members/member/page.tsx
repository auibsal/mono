import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { MemberDetail } from "@/components/admin/members/member";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.admin.member.title"));

const MemberPage = () => (
  <RequireModule module="members">
    <Suspense fallback={<SectionSpinner />}>
      <MemberDetail />
    </Suspense>
  </RequireModule>
);

export default MemberPage;

import { Suspense } from "react";
import { RequireModule } from "@/components/admin/admin-shell";
import { CampaignAdmin } from "@/components/admin/charity/campaign";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.charity.campaigns")
);

const CampaignPage = () => (
  <RequireModule module="charity">
    <Suspense fallback={<SectionSpinner />}>
      <CampaignAdmin />
    </Suspense>
  </RequireModule>
);

export default CampaignPage;

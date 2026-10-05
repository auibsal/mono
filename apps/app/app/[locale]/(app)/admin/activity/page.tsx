import { RequireModule } from "@/components/admin/admin-shell";
import { ActivityLog } from "@/components/admin/system/activity";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.activity.title")
);

const ActivityPage = () => (
  <RequireModule module="activity">
    <ActivityLog />
  </RequireModule>
);

export default ActivityPage;

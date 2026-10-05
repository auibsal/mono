import { RequireModule } from "@/components/admin/admin-shell";
import { SettingsAdmin } from "@/components/admin/system/settings";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.settings.title")
);

const SettingsPage = () => (
  <RequireModule module="settings">
    <SettingsAdmin />
  </RequireModule>
);

export default SettingsPage;

import { RequireModule } from "@/components/admin/admin-shell";
import { JournalAdmin } from "@/components/admin/journal/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.journal.title")
);

const JournalPage = () => (
  <RequireModule module="journal">
    <JournalAdmin />
  </RequireModule>
);

export default JournalPage;

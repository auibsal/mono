import { RequireModule } from "@/components/admin/admin-shell";
import { RecognitionAdmin } from "@/components/admin/recognition/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.recognition.title")
);

const RecognitionPage = () => (
  <RequireModule module="recognition">
    <RecognitionAdmin />
  </RequireModule>
);

export default RecognitionPage;

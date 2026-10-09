import { RequireModule } from "@/components/admin/admin-shell";
import { ProductionsAdmin } from "@/components/admin/productions/admin";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.admin.productions.title")
);

const ProductionsPage = () => (
  <RequireModule module="productions">
    <ProductionsAdmin />
  </RequireModule>
);

export default ProductionsPage;

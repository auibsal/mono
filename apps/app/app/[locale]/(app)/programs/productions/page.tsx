import { Productions } from "@/components/productions/productions";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.productions.title"));

const ProductionsPage = () => <Productions />;

export default ProductionsPage;

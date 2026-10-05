import { WaraqHome } from "@/components/waraq/pages";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.waraq.title"));

const WaraqPage = () => <WaraqHome />;

export default WaraqPage;

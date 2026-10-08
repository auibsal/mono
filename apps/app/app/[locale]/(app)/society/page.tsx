import { Society } from "@/components/society/society";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.society.title"));

const SocietyPage = () => <Society />;

export default SocietyPage;

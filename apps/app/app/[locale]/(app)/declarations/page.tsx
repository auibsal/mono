import { Declarations } from "@/components/declarations/declarations";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.declarations.title"));

const DeclarationsPage = () => <Declarations />;

export default DeclarationsPage;

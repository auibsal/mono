import { Documents } from "@/components/documents/documents";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.documents.title"));

const DocumentsPage = () => <Documents />;

export default DocumentsPage;

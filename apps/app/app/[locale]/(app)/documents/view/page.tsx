import { Suspense } from "react";
import { DocumentView } from "@/components/documents/documents";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.documents.title"));

const DocumentViewPage = () => (
  <Suspense>
    <DocumentView />
  </Suspense>
);

export default DocumentViewPage;

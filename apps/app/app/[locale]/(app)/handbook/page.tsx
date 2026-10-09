import { Suspense } from "react";
import { Handbook } from "@/components/handbook/handbook";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.handbook.title"));

const HandbookPage = () => (
  <Suspense>
    <Handbook />
  </Suspense>
);

export default HandbookPage;

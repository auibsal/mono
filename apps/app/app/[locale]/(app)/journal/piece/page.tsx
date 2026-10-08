import { Suspense } from "react";
import { PieceReader } from "@/components/journal/piece";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.journal.title"));

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <PieceReader />
  </Suspense>
);

export default Page;

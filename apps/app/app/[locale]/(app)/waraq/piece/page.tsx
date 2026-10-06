import { Suspense } from "react";
import { SectionSpinner } from "@/components/states";
import { PieceReader } from "@/components/waraq/piece";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.waraq.title"));

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <PieceReader />
  </Suspense>
);

export default Page;

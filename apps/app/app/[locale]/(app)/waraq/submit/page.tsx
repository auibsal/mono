import { Suspense } from "react";
import { SectionSpinner } from "@/components/states";
import { SubmitWork } from "@/components/waraq/pages";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.waraq.submitTitle"));

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <SubmitWork />
  </Suspense>
);

export default Page;

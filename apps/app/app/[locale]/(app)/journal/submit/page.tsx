import { Suspense } from "react";
import { SubmitWork } from "@/components/journal/pages";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.journal.submitTitle")
);

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <SubmitWork />
  </Suspense>
);

export default Page;

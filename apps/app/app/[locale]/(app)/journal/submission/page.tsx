import { Suspense } from "react";
import { MySubmission } from "@/components/journal/pages";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.journal.submissionTitle")
);

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <MySubmission />
  </Suspense>
);

export default Page;

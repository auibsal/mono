import { Suspense } from "react";
import { SectionSpinner } from "@/components/states";
import { MySubmission } from "@/components/waraq/pages";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("nexus.waraq.submissionTitle")
);

const Page = () => (
  <Suspense fallback={<SectionSpinner />}>
    <MySubmission />
  </Suspense>
);

export default Page;

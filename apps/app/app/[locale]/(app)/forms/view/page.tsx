import { Suspense } from "react";
import { ViewForm } from "@/components/forms/view";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.forms.viewTitle"));

const ViewPage = () => (
  <Suspense>
    <ViewForm />
  </Suspense>
);

export default ViewPage;

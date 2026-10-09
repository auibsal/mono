import { Suspense } from "react";
import { FillForm } from "@/components/forms/fill";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.forms.fillTitle"));

const FillPage = () => (
  <Suspense>
    <FillForm />
  </Suspense>
);

export default FillPage;

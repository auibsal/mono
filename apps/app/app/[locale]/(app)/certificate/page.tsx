import { Suspense } from "react";
import { Certificate } from "@/components/certificates/certificate";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.certificate.title"));

const CertificatePage = () => (
  <Suspense>
    <Certificate />
  </Suspense>
);

export default CertificatePage;

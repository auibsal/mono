import { Service } from "@/components/service/service";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.service.title"));

const ServicePage = () => <Service />;

export default ServicePage;

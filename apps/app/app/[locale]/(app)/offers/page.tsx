import { Offers } from "@/components/offers/offers";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.offers.title"));

const OffersPage = () => <Offers />;

export default OffersPage;

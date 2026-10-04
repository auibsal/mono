import { Billing } from "@/components/screens/billing";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("billing.title"));

const BillingPage = () => <Billing />;

export default BillingPage;

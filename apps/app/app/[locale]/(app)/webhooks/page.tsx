import { Webhooks } from "@/components/screens/webhooks";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("app.nav.webhooks"));

const WebhooksPage = () => <Webhooks />;

export default WebhooksPage;

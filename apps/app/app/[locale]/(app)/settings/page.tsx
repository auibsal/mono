import { Settings } from "@/components/screens/settings";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("app.settings.title"));

const SettingsPage = () => <Settings />;

export default SettingsPage;

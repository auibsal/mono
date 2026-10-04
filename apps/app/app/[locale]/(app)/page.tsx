import { Dashboard } from "@/components/screens/dashboard";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("app.dashboard.title"));

const DashboardPage = () => <Dashboard />;

export default DashboardPage;

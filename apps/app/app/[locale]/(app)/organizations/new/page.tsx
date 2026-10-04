import { NewOrganization } from "@/components/screens/new-organization";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("app.organizations.new.title")
);

const NewOrganizationPage = () => <NewOrganization />;

export default NewOrganizationPage;

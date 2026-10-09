import { Forms } from "@/components/forms/forms";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.forms.title"));

const FormsPage = () => <Forms />;

export default FormsPage;

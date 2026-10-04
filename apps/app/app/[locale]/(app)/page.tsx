import { MemberHome } from "@/components/home/member-home";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.nav.home"));

const HomePage = () => <MemberHome />;

export default HomePage;

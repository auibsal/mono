import { ProgrammesBrowser } from "@/components/programmes/programmes-browser";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.programs.title"));

const ProgrammesPage = () => <ProgrammesBrowser />;

export default ProgrammesPage;

import { JournalHome } from "@/components/journal/pages";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.journal.title"));

const JournalHomePage = () => <JournalHome />;

export default JournalHomePage;

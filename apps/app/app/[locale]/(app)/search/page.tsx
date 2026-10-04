import { Suspense } from "react";
import { SearchResults } from "@/components/screens/search-results";
import { SectionSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("app.search.title"));

const SearchPage = () => (
  <Suspense fallback={<SectionSpinner />}>
    <SearchResults />
  </Suspense>
);

export default SearchPage;

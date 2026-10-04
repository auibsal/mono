import { Spinner } from "@repo/design-system/components/ui/spinner";
import { LocaleRedirect } from "@/components/locale-redirect";

/** Entry point (and the page the native apps load first). */
const EntryPage = () => (
  <div className="flex min-h-dvh items-center justify-center">
    <Spinner className="size-6 text-muted-foreground" />
    <LocaleRedirect />
  </div>
);

export default EntryPage;

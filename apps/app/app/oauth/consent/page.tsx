import { Spinner } from "@repo/design-system/components/ui/spinner";
import { LocaleRedirect } from "@/components/locale-redirect";

/**
 * Supabase Auth sends "Sign in with SAL" here (Site URL + /oauth/consent),
 * without a language. Forward to /<locale>/oauth/consent, keeping the query.
 */
const ConsentEntry = () => (
  <div className="flex min-h-dvh items-center justify-center">
    <Spinner className="size-6 text-muted-foreground" />
    <LocaleRedirect />
  </div>
);

export default ConsentEntry;

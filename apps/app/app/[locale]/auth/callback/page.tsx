import { Suspense } from "react";
import { AuthCallback } from "@/components/auth/auth-callback";
import { FullPageSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.callback.title"));

const AuthCallbackPage = () => (
  <Suspense fallback={<FullPageSpinner />}>
    <AuthCallback />
  </Suspense>
);

export default AuthCallbackPage;

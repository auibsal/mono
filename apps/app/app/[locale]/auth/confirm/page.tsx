import { Suspense } from "react";
import { AuthConfirm } from "@/components/auth/auth-confirm";
import { FullPageSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.confirm.title"));

const AuthConfirmPage = () => (
  <Suspense fallback={<FullPageSpinner />}>
    <AuthConfirm />
  </Suspense>
);

export default AuthConfirmPage;

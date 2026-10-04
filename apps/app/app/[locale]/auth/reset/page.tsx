import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetForm } from "@/components/auth/reset-form";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.reset.title"));

const ResetPage = () => (
  <AuthFrame>
    <ResetForm />
  </AuthFrame>
);

export default ResetPage;

import { ForgotForm } from "@/components/auth/forgot-form";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.forgot.title"));

const ForgotPasswordPage = () => <ForgotForm />;

export default ForgotPasswordPage;

import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.signIn.title"));

const SignInPage = () => (
  <Suspense>
    <SignInForm />
  </Suspense>
);

export default SignInPage;

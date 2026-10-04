import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.signUp.title"));

const SignUpPage = () => (
  <Suspense>
    <SignUpForm />
  </Suspense>
);

export default SignUpPage;

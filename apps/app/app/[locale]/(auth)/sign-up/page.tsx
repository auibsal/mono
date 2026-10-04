import { Suspense } from "react";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.signUp.title"));

const SignUpPage = () => (
  <Suspense>
    <PhoneSignIn mode="sign-up" />
  </Suspense>
);

export default SignUpPage;

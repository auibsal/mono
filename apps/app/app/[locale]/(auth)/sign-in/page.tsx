import { Suspense } from "react";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("auth.signIn.title"));

const SignInPage = () => (
  <Suspense>
    <PhoneSignIn mode="sign-in" />
  </Suspense>
);

export default SignInPage;

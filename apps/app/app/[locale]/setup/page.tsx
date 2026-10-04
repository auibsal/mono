import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { RequireAuth } from "@/components/gates";
import { SetupForm } from "@/components/setup-form";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.setup.title"));

const SetupPage = () => (
  <RequireAuth>
    <AuthFrame>
      <Suspense>
        <SetupForm />
      </Suspense>
    </AuthFrame>
  </RequireAuth>
);

export default SetupPage;

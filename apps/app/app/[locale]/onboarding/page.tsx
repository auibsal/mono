import { project } from "@repo/config";
import { Suspense } from "react";
import { RequireAuth } from "@/components/gates";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { FullPageSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) =>
  t("app.onboarding.title", { name: project.name })
);

const OnboardingPage = () => (
  <RequireAuth>
    <Suspense fallback={<FullPageSpinner />}>
      <OnboardingFlow />
    </Suspense>
  </RequireAuth>
);

export default OnboardingPage;

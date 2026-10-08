import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { RequireAuth } from "@/components/gates";
import { OAuthConsent } from "@/components/oauth/consent";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.oauth.title"));

const ConsentPage = () => (
  <RequireAuth>
    <AuthFrame>
      <Suspense>
        <OAuthConsent />
      </Suspense>
    </AuthFrame>
  </RequireAuth>
);

export default ConsentPage;

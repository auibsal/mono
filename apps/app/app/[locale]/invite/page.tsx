import { Suspense } from "react";
import { RequireAuth } from "@/components/gates";
import { InviteAccept } from "@/components/invite-accept";
import { FullPageSpinner } from "@/components/states";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("app.invite.title"));

const InvitePage = () => (
  <RequireAuth>
    <Suspense fallback={<FullPageSpinner />}>
      <InviteAccept />
    </Suspense>
  </RequireAuth>
);

export default InvitePage;

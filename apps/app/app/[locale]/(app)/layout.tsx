import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth, RequireMember } from "@/components/gates";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/** Signed-in, verified members with current pledges. */
const AppLayout = ({ children }: AppLayoutProps) => (
  <RequireAuth>
    <RequireMember>
      <AppShell>{children}</AppShell>
    </RequireMember>
  </RequireAuth>
);

export default AppLayout;

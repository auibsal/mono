import {
  SidebarInset,
  SidebarProvider,
} from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { RequireAuth } from "@/components/gates";
import { NotificationsProvider } from "@/components/notifications-provider";
import { OrganizationProvider } from "@/components/organization-provider";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/** The signed-in app: requires a session and an organization. */
const AppLayout = ({ children }: AppLayoutProps) => {
  let shell = (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );

  shell = <NotificationsProvider>{shell}</NotificationsProvider>;

  return (
    <RequireAuth>
      <OrganizationProvider>{shell}</OrganizationProvider>
    </RequireAuth>
  );
};

export default AppLayout;

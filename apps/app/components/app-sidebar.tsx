"use client";

import { resetIdentity } from "@repo/analytics/client";
import { OrganizationSwitcher } from "@repo/auth/components/organization-switcher";
import { UserMenu } from "@repo/auth/components/user-menu";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  Link,
  usePathname,
  useRouter,
} from "@repo/internationalization/navigation";
import { NotificationsTrigger } from "@repo/notifications/components/trigger";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCardIcon,
  FolderIcon,
  type LucideIcon,
  Settings2Icon,
  WebhookIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuthMessages } from "@/lib/auth-messages";
import { useProfile } from "@/lib/queries";
import { LanguageSwitcher } from "./language-switcher";
import { useOrganization } from "./organization-provider";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href: string;
  icon: LucideIcon;
  title: string;
}

export const AppSidebar = () => {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authMessages = useAuthMessages();
  const { active, organizations, select } = useOrganization();
  const { isMobile, setOpenMobile } = useSidebar();
  const profile = useProfile();

  const items: NavItem[] = [
    { href: "/", icon: FolderIcon, title: t("dashboard") },
    { href: "/billing", icon: CreditCardIcon, title: t("billing") },
    { href: "/settings", icon: Settings2Icon, title: t("settings") },
    // <module:webhooks>
    { href: "/webhooks", icon: WebhookIcon, title: t("webhooks") },
    // </module:webhooks>
  ];

  const closeOnMobile = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <BrandLogo />
        </div>
        <OrganizationSwitcher
          activeId={active.id}
          messages={authMessages}
          onCreate={() => {
            closeOnMobile();
            router.push("/organizations/new");
          }}
          onSelect={select}
          organizations={organizations}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("label")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href} onClick={closeOnMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-1">
          <UserMenu
            messages={authMessages}
            name={profile.data?.full_name}
            onSignedOut={() => {
              queryClient.clear();
              resetIdentity();
              router.replace("/sign-in");
            }}
          />
          <div className="flex shrink-0 items-center">
            {/* <module:notifications> */}
            <NotificationsTrigger />
            {/* </module:notifications> */}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

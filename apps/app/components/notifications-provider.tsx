"use client";

import { useAuth } from "@repo/auth/provider";
import { NotificationsProvider as RawNotificationsProvider } from "@repo/notifications/components/provider";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

interface NotificationsProviderProperties {
  readonly children: ReactNode;
}

/** Knock's in-app feed for the signed-in user. */
export const NotificationsProvider = ({
  children,
}: NotificationsProviderProperties) => {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();

  if (!user) {
    return children;
  }

  return (
    <RawNotificationsProvider
      theme={resolvedTheme as "light" | "dark"}
      userId={user.id}
    >
      {children}
    </RawNotificationsProvider>
  );
};

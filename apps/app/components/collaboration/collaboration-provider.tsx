"use client";

import { useAuth } from "@repo/auth/provider";
import { presenceColor } from "@repo/collaboration/colors";
import { Room } from "@repo/collaboration/room";
import Fuse from "fuse.js";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { callApi } from "@/lib/api";

type CustomAuthResult =
  | { token: string }
  | { error: "forbidden"; reason: string };

interface CollaborationProviderProps {
  readonly children: ReactNode;
  readonly organizationId: string;
}

/**
 * Liveblocks room for the organization. The token comes from apps/api (it
 * holds the secret); member names are read with the user's own Supabase
 * session, so RLS limits them to teammates.
 */
export const CollaborationProvider = ({
  children,
  organizationId,
}: CollaborationProviderProps) => {
  const { supabase } = useAuth();
  const t = useTranslations("common");

  const members = async () => {
    const { data: memberships, error } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organizationId);
    if (error) {
      throw error;
    }
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in(
        "id",
        memberships.map((membership) => membership.user_id)
      );
    if (profilesError) {
      throw profilesError;
    }
    return profiles;
  };

  const resolveUsers = async ({ userIds }: { userIds: string[] }) => {
    const profiles = new Map(
      (await members()).map((profile) => [profile.id, profile])
    );
    return userIds.map((userId) => {
      const profile = profiles.get(userId);
      return profile
        ? {
            avatar: profile.avatar_url ?? undefined,
            color: presenceColor(userId),
            name: profile.full_name ?? undefined,
          }
        : undefined;
    });
  };

  const resolveMentionSuggestions = async ({ text }: { text: string }) => {
    const profiles = await members();
    if (!text) {
      return profiles.map((profile) => profile.id);
    }
    return new Fuse(profiles, { keys: ["full_name"], threshold: 0.3 })
      .search(text)
      .map((result) => result.item.id);
  };

  return (
    <Room
      authEndpoint={(room) =>
        callApi<CustomAuthResult>(supabase, "/collaboration/auth", { room })
      }
      fallback={
        <span className="px-3 text-muted-foreground text-xs">
          {t("loading")}
        </span>
      }
      id={`${organizationId}:presence`}
      resolveMentionSuggestions={resolveMentionSuggestions}
      resolveUsers={resolveUsers}
    >
      {children}
    </Room>
  );
};

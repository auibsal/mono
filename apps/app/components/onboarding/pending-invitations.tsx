"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { rememberActiveOrganization } from "@/lib/active-organization";
import { type InvitationError, toInvitationError } from "@/lib/errors";
import { usePendingInvitations } from "@/lib/queries";

interface PendingInvitationsProps {
  readonly onJoined: () => void;
}

/** Invitations addressed to this user's phone number or email. */
export const PendingInvitations = ({ onJoined }: PendingInvitationsProps) => {
  const t = useTranslations("app");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const invitations = usePendingInvitations();
  const [error, setError] = useState<InvitationError | null>(null);

  const join = useMutation({
    mutationFn: async (token: string) => {
      const { data, error: rpcError } = await supabase.rpc(
        "accept_invitation",
        { invitation_token: token }
      );
      if (rpcError) {
        throw rpcError;
      }
      return data;
    },
    onError: (mutationError) => setError(toInvitationError(mutationError)),
    onSuccess: async (organizationId) => {
      rememberActiveOrganization(organizationId);
      await queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onJoined();
    },
  });

  if (!invitations.data?.length) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="font-medium">{t("onboarding.invitations.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("onboarding.invitations.description")}
        </p>
      </div>
      <ul className="grid gap-2">
        {invitations.data.map((invitation) => (
          <li
            className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3"
            key={invitation.token}
          >
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm">
                {invitation.organization_name}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("onboarding.invitations.as", {
                  role: t(`roles.${invitation.role}`),
                })}
              </span>
            </div>
            <Button
              disabled={join.isPending}
              onClick={() => join.mutate(invitation.token)}
              size="sm"
            >
              {join.isPending && join.variables === invitation.token
                ? t("onboarding.invitations.joining")
                : t("onboarding.invitations.join")}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {t(`invite.errors.${error}`)}
        </p>
      ) : null}
    </section>
  );
};

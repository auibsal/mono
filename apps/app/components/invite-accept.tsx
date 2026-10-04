"use client";

import { useAuth } from "@repo/auth/provider";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { rememberActiveOrganization } from "@/lib/active-organization";
import { type InvitationError, toInvitationError } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts an invitation from a link like /ar/invite?token=… */
export const InviteAccept = () => {
  const t = useTranslations("app.invite");
  const token = useSearchParams().get("token") ?? "";
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<InvitationError | null>(null);

  const accept = useMutation({
    mutationFn: async () => {
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
      router.replace("/");
    },
  });

  const valid = UUID.test(token);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <BrandLogo />
      <div className="grid gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {valid ? t("description") : t("missing")}
        </p>
      </div>
      {valid ? (
        <>
          <p className="text-muted-foreground text-sm">{t("signInFirst")}</p>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {t(`errors.${error}`)}
            </p>
          ) : null}
          <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? t("accepting") : t("accept")}
          </Button>
        </>
      ) : null}
    </main>
  );
};

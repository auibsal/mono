"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { formatLongDate } from "@repo/internationalization/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

const KEY = ["oauth-grants"];

/**
 * Profile and privacy: apps the member allowed to sign them in (Sign in with
 * SAL). Disconnecting ends the app's sessions and refresh tokens. Hidden
 * when there are none, or when the OAuth server is off.
 */
export const ConnectedApps = () => {
  const t = useTranslations("nexus.profile.apps");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();

  const grants = useQuery({
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.listGrants();
      return error ? [] : (data ?? []);
    },
    queryKey: KEY,
  });

  const revoke = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  if (!grants.data?.length) {
    return null;
  }

  return (
    <SalCard>
      <div className="grid gap-3">
        <h2 className="type-subheading">{t("title")}</h2>
        <p className="type-body">{t("description")}</p>
        <ul className="grid gap-3">
          {grants.data.map((grant) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3"
              key={grant.client.id}
            >
              <div className="grid">
                <span className="type-body" dir="auto">
                  {grant.client.name}
                </span>
                <span className="type-caption">
                  {t("since", {
                    date: formatLongDate(grant.granted_at, locale),
                  })}
                </span>
              </div>
              <Button
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(grant.client.id)}
                variant="outline"
              >
                {t("disconnect")}
              </Button>
            </li>
          ))}
        </ul>
        {revoke.isError ? (
          <p className="text-title" role="alert">
            {t("failed")}
          </p>
        ) : null}
      </div>
    </SalCard>
  );
};
